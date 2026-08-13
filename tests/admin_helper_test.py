import importlib.util
from importlib.machinery import SourceFileLoader
import json
import os
import tempfile
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


if __name__ == "__main__":
    unittest.main()
