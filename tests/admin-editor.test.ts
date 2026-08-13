import assert from "node:assert/strict";
import test from "node:test";
import {
  createGroup,
  deleteAdmin,
  deleteGroup,
  findDuplicateIdentities,
  renameGroup,
  updateAdmin,
  updateGroup,
} from "../lib/admin-editor.ts";
import type { AdminConfiguration } from "../lib/types.ts";

const base: AdminConfiguration = {
  admins: {
    Alice: { identity: "76561190000000001", groups: ["#css/admin"] },
    Bob: { identity: "76561190000000002", groups: ["#css/mod"] },
  },
  groups: {
    "#css/admin": { flags: ["@css/root"], immunity: 100 },
    "#css/mod": { flags: ["@css/kick"], immunity: 10 },
  },
  overrides: {},
};

test("updates and removes admins without mutating the source", () => {
  const updated = updateAdmin(base, "Alice", {
    identity: "76561190000000003",
  });
  assert.equal(updated.admins.Alice.identity, "76561190000000003");
  assert.equal(base.admins.Alice.identity, "76561190000000001");
  assert.equal(deleteAdmin(updated, "Alice").admins.Alice, undefined);
});

test("creates a unique group and updates a group", () => {
  const first = createGroup(base);
  assert.equal(first.name, "#custom/group");
  const second = createGroup(first.config);
  assert.equal(second.name, "#custom/group-2");
  assert.deepEqual(
    updateGroup(base, "#css/mod", { flags: [], immunity: 20 }).groups[
      "#css/mod"
    ],
    { flags: [], immunity: 20 },
  );
});

test("renames a group and synchronizes every admin reference", () => {
  const renamed = renameGroup(base, "#css/admin", " #custom/owner ");
  assert.ok(renamed);
  assert.equal(renamed.groups["#css/admin"], undefined);
  assert.deepEqual(renamed.admins.Alice.groups, ["#custom/owner"]);
  assert.deepEqual(base.admins.Alice.groups, ["#css/admin"]);
});

test("rejects invalid or conflicting group names", () => {
  assert.equal(renameGroup(base, "#css/admin", "invalid"), null);
  assert.equal(renameGroup(base, "#css/admin", "#css/mod"), null);
  assert.equal(renameGroup(base, "#css/admin", "#css/admin"), null);
});

test("only deletes groups that are not referenced", () => {
  assert.equal(deleteGroup(base, "#css/admin"), null);
  const unused = updateGroup(base, "#custom/unused", { flags: [] });
  assert.equal(deleteGroup(unused, "#custom/unused")?.groups["#custom/unused"], undefined);
});

test("finds all duplicate Steam identities", () => {
  const duplicate = updateAdmin(base, "Bob", {
    ...base.admins.Bob,
    identity: base.admins.Alice.identity,
  });
  assert.deepEqual(
    [...findDuplicateIdentities(duplicate)],
    ["76561190000000001"],
  );
});
