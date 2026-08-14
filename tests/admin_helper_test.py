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

    def test_lists_only_real_plugin_directories(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.PLUGIN_ROOT = directory
            disabled = os.path.join(directory, "disabled")
            os.makedirs(disabled)
            os.makedirs(os.path.join(directory, "ActivePlugin"))
            os.makedirs(os.path.join(disabled, "DisabledPlugin"))
            os.symlink("ActivePlugin", os.path.join(directory, "LinkedPlugin"))
            with mock.patch.object(helper, "drop_to_steam"):
                self.assertEqual(
                    helper.plugin_directories(),
                    {
                        "active": ["ActivePlugin"],
                        "disabled": ["DisabledPlugin"],
                    },
                )

    def test_writes_announcement_config_to_persistent_and_runtime_copies(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.PLUGIN_ROOT = os.path.join(directory, "runtime")
            helper.PLUGIN_CUSTOM_ROOT = os.path.join(directory, "custom")
            helper.PLUGIN_BACKUP_ROOT = os.path.join(directory, "backups")
            runtime = os.path.join(
                helper.PLUGIN_ROOT,
                "CS2AnnouncementBroadcaster",
                "cfg",
                "messages.json",
            )
            os.makedirs(os.path.dirname(runtime))
            original = {"OnRoundStartMsgs": [{"msg": "Old"}]}
            with open(runtime, "w", encoding="utf-8") as handle:
                json.dump(original, handle)
            current = helper.read_plugin_config("announcements")
            changed = {
                "OnPlayerConnectMsgs": [{"msg": "Hello", "delay": 3}],
                "OnCommandMsgs": [{"msg": "Help", "cmd": "help"}],
            }
            with mock.patch.object(
                helper.pwd,
                "getpwnam",
                return_value=mock.Mock(pw_uid=os.getuid(), pw_gid=os.getgid()),
            ):
                result = helper.write_plugin_config(
                    "announcements", changed, current["hash"]
                )
            self.assertTrue(result["persisted"])
            self.assertEqual(result["config"]["OnCommandMsgs"][0]["cmd"], "help")
            source, runtime = helper.plugin_config_paths("announcements")
            for path in (source, runtime):
                with open(path, encoding="utf-8") as handle:
                    self.assertEqual(json.load(handle), result["config"])
            self.assertEqual(
                len(os.listdir(os.path.join(helper.PLUGIN_BACKUP_ROOT, "announcements"))),
                1,
            )

    def test_rejects_invalid_announcement_commands(self):
        helper = load_helper()
        with self.assertRaises(SystemExit):
            helper.validate_announcement_config(
                {"OnCommandMsgs": [{"msg": "Bad", "cmd": "quit;exec"}]}
            )

    def test_reads_and_writes_custom_votes_jsonc(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.PLUGIN_CONFIG_ROOT = os.path.join(directory, "runtime-config")
            helper.PLUGIN_CUSTOM_CONFIG_ROOT = os.path.join(directory, "custom-config")
            helper.PLUGIN_BACKUP_ROOT = os.path.join(directory, "backups")
            runtime = os.path.join(
                helper.PLUGIN_CONFIG_ROOT,
                "CS2-CustomVotes",
                "CS2-CustomVotes.json",
            )
            os.makedirs(os.path.dirname(runtime))
            with open(runtime, "w", encoding="utf-8") as handle:
                handle.write(
                    '// generated configuration\n'
                    '{"CustomVotesEnabled":true,"VoteCooldown":60,'
                    '"ChatPrefix":"https://example.test // text",'
                    '"ForceStyle":"none","CustomVotes":[{}],"ConfigVersion":2}'
                )
            current = helper.read_plugin_config("custom-votes")
            self.assertEqual(current["config"]["CustomVotes"], [])
            changed = {
                **current["config"],
                "CustomVotes": [
                    {
                        "Command": "cheats",
                        "CommandAliases": ["svcheats"],
                        "Description": "切换作弊模式",
                        "TimeToVote": 30,
                        "Options": {
                            "Enable": {"Text": "启用", "Commands": ["sv_cheats 1"]},
                            "Disable": {"Text": "禁用", "Commands": ["sv_cheats 0"]},
                        },
                        "DefaultOption": "Disable",
                        "Style": "chat",
                        "MinVotePercentage": -1,
                        "Permission": {"RequiresAll": False, "Permissions": ["@css/generic"]},
                    }
                ],
            }
            with mock.patch.object(
                helper.pwd,
                "getpwnam",
                return_value=mock.Mock(pw_uid=os.getuid(), pw_gid=os.getgid()),
            ):
                result = helper.write_plugin_config(
                    "custom-votes", changed, current["hash"]
                )
            self.assertTrue(result["persisted"])
            source, runtime = helper.plugin_config_paths("custom-votes")
            for path in (source, runtime):
                with open(path, encoding="utf-8") as handle:
                    self.assertEqual(json.load(handle), changed)

    def test_rejects_custom_vote_with_missing_default_option(self):
        helper = load_helper()
        vote = {
            "Command": "test",
            "CommandAliases": [],
            "Description": "Test",
            "TimeToVote": 30,
            "Options": {
                "Yes": {"Text": "Yes", "Commands": ["say yes"]},
                "No": {"Text": "No", "Commands": ["say no"]},
            },
            "DefaultOption": "Missing",
            "Style": "center",
            "MinVotePercentage": 50,
            "Permission": {"RequiresAll": False, "Permissions": []},
        }
        with self.assertRaises(SystemExit):
            helper.validate_custom_votes_config(
                {
                    "CustomVotesEnabled": True,
                    "VoteCooldown": 60,
                    "ChatPrefix": "Server",
                    "ForceStyle": "none",
                    "CustomVotes": [vote],
                    "ConfigVersion": 2,
                }
            )

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

    def test_manages_only_whitelisted_cfg_files_with_history(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.CFG_SOURCE_DIR = os.path.join(directory, "source")
            helper.CFG_RUNTIME_DIR = os.path.join(directory, "runtime")
            helper.CFG_BACKUP_DIR = os.path.join(directory, "backups")
            helper.CFG_LOCK_FILE = os.path.join(directory, "cfg.lock")
            os.makedirs(helper.CFG_RUNTIME_DIR)
            runtime = os.path.join(helper.CFG_RUNTIME_DIR, "server.cfg")
            with open(runtime, "w", encoding="utf-8") as handle:
                handle.write("hostname old\n")
            with mock.patch.object(
                helper,
                "ensure_cfg_directories",
                side_effect=lambda: (
                    os.makedirs(helper.CFG_SOURCE_DIR, exist_ok=True),
                    os.makedirs(helper.CFG_BACKUP_DIR, exist_ok=True),
                    (os.getuid(), os.getgid()),
                )[-1],
            ):
                before = helper.read_cfg("server")
                result = helper.apply_cfg(
                    "server", "hostname new\n", before["hash"]
                )
                self.assertTrue(result["persisted"])
                self.assertEqual(result["content"], "hostname new\n")
                with open(runtime, encoding="utf-8") as handle:
                    self.assertEqual(handle.read(), "hostname new\n")
                history = helper.cfg_history("server")
                self.assertEqual(len(history), 1)
                restored = helper.restore_cfg(
                    "server", history[0]["id"], result["hash"]
                )
                self.assertEqual(restored["content"], "hostname old\n")

            with self.assertRaises(SystemExit):
                helper.read_cfg("../../etc/passwd")

    def test_cfg_write_rejects_stale_hash_and_unsafe_content(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.CFG_SOURCE_DIR = os.path.join(directory, "source")
            helper.CFG_RUNTIME_DIR = os.path.join(directory, "runtime")
            helper.CFG_BACKUP_DIR = os.path.join(directory, "backups")
            os.makedirs(helper.CFG_SOURCE_DIR)
            os.makedirs(helper.CFG_RUNTIME_DIR)
            for parent in (helper.CFG_SOURCE_DIR, helper.CFG_RUNTIME_DIR):
                with open(os.path.join(parent, "custom_all.cfg"), "w", encoding="utf-8") as handle:
                    handle.write("hostname current\n")
            with self.assertRaises(SystemExit):
                helper.apply_cfg("common", "hostname changed\n", "0" * 64)
            with self.assertRaises(SystemExit):
                helper.validate_cfg_content("hostname ok\x00quit")

    def test_cfg_write_restores_both_copies_after_partial_failure(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.CFG_SOURCE_DIR = os.path.join(directory, "source")
            helper.CFG_RUNTIME_DIR = os.path.join(directory, "runtime")
            helper.CFG_BACKUP_DIR = os.path.join(directory, "backups")
            for parent in (helper.CFG_SOURCE_DIR, helper.CFG_RUNTIME_DIR):
                os.makedirs(parent)
                with open(os.path.join(parent, "server.cfg"), "w", encoding="utf-8") as handle:
                    handle.write("hostname old\n")

            original_write = helper.atomic_cfg_write
            runtime = os.path.join(helper.CFG_RUNTIME_DIR, "server.cfg")
            failed = False

            def fail_runtime_once(path, content, uid, gid):
                nonlocal failed
                if path == runtime and content == "hostname new\n" and not failed:
                    failed = True
                    raise OSError("simulated runtime write failure")
                return original_write(path, content, uid, gid)

            with mock.patch.object(
                helper,
                "ensure_cfg_directories",
                side_effect=lambda: (
                    os.makedirs(helper.CFG_BACKUP_DIR, exist_ok=True),
                    (os.getuid(), os.getgid()),
                )[-1],
            ), mock.patch.object(helper, "atomic_cfg_write", side_effect=fail_runtime_once):
                current = helper.read_cfg("server")
                with self.assertRaisesRegex(RuntimeError, "已恢复原配置"):
                    helper.apply_cfg("server", "hostname new\n", current["hash"])

            for parent in (helper.CFG_SOURCE_DIR, helper.CFG_RUNTIME_DIR):
                with open(os.path.join(parent, "server.cfg"), encoding="utf-8") as handle:
                    self.assertEqual(handle.read(), "hostname old\n")

    def test_cfg_backup_prunes_versions_beyond_retention_limit(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            helper.CFG_BACKUP_DIR = directory
            backup_directory = os.path.join(directory, "server")
            os.makedirs(backup_directory)
            for index in range(helper.CFG_BACKUP_LIMIT + 3):
                filename = f"20260814T0100{index:02d}.000000Z.cfg"
                with open(os.path.join(backup_directory, filename), "w", encoding="utf-8") as handle:
                    handle.write(str(index))

            helper.prune_cfg_backups("server")

            backups = os.listdir(backup_directory)
            self.assertEqual(len(backups), helper.CFG_BACKUP_LIMIT)
            self.assertNotIn("20260814T010000.000000Z.cfg", backups)
            self.assertIn("20260814T010052.000000Z.cfg", backups)

            helper.prune_cfg_backups("server", 5)
            self.assertEqual(len(os.listdir(backup_directory)), 5)

    def test_cfg_privilege_drop_removes_root_before_file_operations(self):
        helper = load_helper()
        steam = mock.Mock(pw_uid=1234, pw_gid=2345)
        calls = []
        with mock.patch.object(helper.pwd, "getpwnam", return_value=steam), \
             mock.patch.object(helper.os, "geteuid", return_value=0), \
             mock.patch.object(helper.os, "setgroups", side_effect=lambda groups: calls.append(("groups", groups))), \
             mock.patch.object(helper.os, "setgid", side_effect=lambda gid: calls.append(("gid", gid))), \
             mock.patch.object(helper.os, "setuid", side_effect=lambda uid: calls.append(("uid", uid))):
            helper.drop_to_steam()

        self.assertEqual(calls, [("groups", []), ("gid", 2345), ("uid", 1234)])

    def test_storage_usage_counts_regular_files_and_skips_symlinks(self):
        helper = load_helper()
        with tempfile.TemporaryDirectory() as directory:
            nested = os.path.join(directory, "nested")
            os.makedirs(nested)
            with open(os.path.join(directory, "one.cfg"), "wb") as handle:
                handle.write(b"1234")
            with open(os.path.join(nested, "two.cfg"), "wb") as handle:
                handle.write(b"123456")
            os.symlink(os.path.join(directory, "one.cfg"), os.path.join(directory, "ignored.cfg"))

            self.assertEqual(
                helper.fixed_directory_usage(directory),
                {"files": 2, "bytes": 10},
            )

    def test_cfg_retention_is_bounded(self):
        helper = load_helper()
        self.assertEqual(helper.cfg_retention(25), 25)
        for invalid in (4, 201, True, "50"):
            with self.assertRaises(SystemExit):
                helper.cfg_retention(invalid)


if __name__ == "__main__":
    unittest.main()
