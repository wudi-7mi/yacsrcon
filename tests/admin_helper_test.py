import importlib.util
from importlib.machinery import SourceFileLoader
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock


SCRIPT = os.path.join(os.path.dirname(__file__), "..", "system", "yacsrcon-admin-helper")


def load_helper():
    loader = SourceFileLoader("yacsrcon_admin_helper", SCRIPT)
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


class AdminHelperTransactionTest(unittest.TestCase):
    def test_restores_all_files_when_a_replace_fails(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.CONFIG_DIR = directory
            helper.BACKUP_DIR = os.path.join(directory, "backups", "yacsrcon")
            original = {
                "admins": {"Original": {"identity": "76561197960265731", "groups": ["#css/admin"]}},
                "groups": {"#css/admin": {"flags": ["@css/root"], "immunity": 100}},
                "overrides": {},
            }
            updated = {
                "admins": {"Changed": {"identity": "76561197960265733", "groups": ["#css/admin"]}},
                "groups": {"#css/admin": {"flags": ["@css/kick"], "immunity": 50}},
                "overrides": {"css_test": {"flags": ["@css/root"]}},
            }
            for key, filename in helper.FILES.items():
                with open(os.path.join(directory, filename), "w", encoding="utf-8") as handle:
                    json.dump(original[key], handle)

            real_replace = os.replace
            replacements = 0

            def fail_second_update(source, target):
                nonlocal replacements
                if ".yacsrcon-" in source:
                    replacements += 1
                    if replacements == 2:
                        raise OSError("simulated replacement failure")
                return real_replace(source, target)

            with mock.patch.object(helper.os, "replace", side_effect=fail_second_update):
                with self.assertRaisesRegex(RuntimeError, "已恢复全部配置"):
                    helper.apply_config(updated)

            for key, filename in helper.FILES.items():
                with open(os.path.join(directory, filename), encoding="utf-8") as handle:
                    self.assertEqual(json.load(handle), original[key])

    def test_reads_simple_admin_bans_without_writing_database(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            database_path = os.path.join(directory, "bans.db")
            database = sqlite3.connect(database_path)
            database.execute(
                "CREATE TABLE banned_users ("
                "steam_id TEXT PRIMARY KEY, username TEXT, "
                "minutes_banned INT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
            )
            database.execute(
                "INSERT INTO banned_users VALUES (?, ?, ?, ?)",
                ("76561197960265731", "Player", 120, "2026-08-13 08:00:00"),
            )
            database.commit()
            database.close()
            before = os.stat(database_path).st_mtime_ns
            helper.BAN_DATABASE = database_path

            self.assertEqual(
                helper.read_bans(),
                [
                    {
                        "steamId": "76561197960265731",
                        "playerName": "Player",
                        "minutes": 120,
                        "createdAt": "2026-08-13 08:00:00",
                    }
                ],
            )
            self.assertEqual(os.stat(database_path).st_mtime_ns, before)

    def test_parses_only_supported_server_environment_keys(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.CS2_ENV_FILE = os.path.join(directory, ".env")
            with open(helper.CS2_ENV_FILE, "w", encoding="utf-8") as handle:
                handle.write(
                    "PORT=27015\nTICKRATE=64\nMAXPLAYERS=16\nAPI_KEY=key\n"
                    "RCON_PASSWORD=password\nSTEAM_ACCOUNT=token\nLAN=0\nEXEC=on_boot.cfg\n"
                    "CUSTOM_FOLDER=/home/steam/cs2/custom_files\n"
                    "DUCK_DOMAIN=example.duckdns.org\nDUCK_TOKEN=duck-token\n"
                )
            values = helper.read_server_environment()
            self.assertEqual(values["PORT"], "27015")
            self.assertNotIn("CUSTOM_FOLDER", values)
            self.assertNotIn("DUCK_DOMAIN", values)
            self.assertNotIn("DUCK_TOKEN", values)
            with open(helper.CS2_ENV_FILE, "a", encoding="utf-8") as handle:
                handle.write("PATH=/tmp\n")
            with self.assertRaises(SystemExit):
                helper.read_server_environment()

    def test_redacts_secrets_from_server_logs(self):
        helper = load_helper()
        line = "cs2 -authkey api-value +sv_setsteamaccount token-value +rcon_password secret"
        redacted = helper.redact_log_line(line)
        self.assertNotIn("api-value", redacted)
        self.assertNotIn("token-value", redacted)
        self.assertNotIn("secret", redacted)
        self.assertIn("[REDACTED]", redacted)

    def test_refuses_symlinked_server_logs(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            target = os.path.join(directory, "target")
            link = os.path.join(directory, "server.log")
            with open(target, "w", encoding="utf-8") as handle:
                handle.write("root-only-value\n")
            os.symlink(target, link)
            helper.CS2_LOG_FILE = link
            with self.assertRaises(OSError):
                helper.read_server_logs()

    def test_serializes_server_operations_across_processes(self):
        helper = load_helper()
        self.assertEqual(helper.SERVER_LOCK_FILE, "/run/yacsrcon-cs2-server.lock")
        with tempfile.TemporaryDirectory() as directory:
            lock_path = os.path.join(directory, "server.lock")
            helper.SERVER_LOCK_FILE = lock_path
            holder = subprocess.Popen(
                [
                    sys.executable,
                    "-c",
                    "import fcntl, os, sys, time; "
                    "fd=os.open(sys.argv[1], os.O_RDWR|os.O_CREAT, 0o600); "
                    "fcntl.flock(fd, fcntl.LOCK_EX); print('locked', flush=True); "
                    "time.sleep(0.4)",
                    lock_path,
                ],
                stdout=subprocess.PIPE,
                text=True,
            )
            try:
                self.assertEqual(holder.stdout.readline().strip(), "locked")
                started = time.monotonic()
                with self.assertRaises(SystemExit):
                    with helper.server_operation_lock():
                        self.fail("competing process acquired the server lock")
                self.assertLess(time.monotonic() - started, 0.2)
            finally:
                holder.wait(timeout=2)
                holder.stdout.close()


if __name__ == "__main__":
    unittest.main()
