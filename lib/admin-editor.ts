import type {
  AdminConfiguration,
  CssAdmin,
  CssAdminGroup,
} from "@/lib/types";

export const ADMIN_GROUP_NAME_PATTERN =
  /^#[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;

export function updateAdmin(
  config: AdminConfiguration,
  name: string,
  admin: CssAdmin,
): AdminConfiguration {
  return {
    ...config,
    admins: { ...config.admins, [name]: admin },
  };
}

export function deleteAdmin(
  config: AdminConfiguration,
  name: string,
): AdminConfiguration {
  const admins = { ...config.admins };
  delete admins[name];
  return { ...config, admins };
}

export function updateGroup(
  config: AdminConfiguration,
  name: string,
  group: CssAdminGroup,
): AdminConfiguration {
  return {
    ...config,
    groups: { ...config.groups, [name]: group },
  };
}

export function createGroup(config: AdminConfiguration): {
  config: AdminConfiguration;
  name: string;
} {
  let index = 1;
  let name = "#custom/group";
  while (config.groups[name]) name = `#custom/group-${++index}`;
  return {
    name,
    config: updateGroup(config, name, { flags: [], immunity: 0 }),
  };
}

export function renameGroup(
  config: AdminConfiguration,
  previous: string,
  next: string,
): AdminConfiguration | null {
  const name = next.trim();
  if (
    name === previous ||
    !ADMIN_GROUP_NAME_PATTERN.test(name) ||
    config.groups[name]
  ) {
    return null;
  }

  const groups: AdminConfiguration["groups"] = {};
  for (const [groupName, group] of Object.entries(config.groups)) {
    groups[groupName === previous ? name : groupName] = group;
  }
  const admins = Object.fromEntries(
    Object.entries(config.admins).map(([adminName, admin]) => [
      adminName,
      {
        ...admin,
        groups: admin.groups?.map((group) =>
          group === previous ? name : group,
        ),
      },
    ]),
  );
  return { ...config, groups, admins };
}

export function deleteGroup(
  config: AdminConfiguration,
  name: string,
): AdminConfiguration | null {
  if (
    Object.values(config.admins).some((admin) => admin.groups?.includes(name))
  ) {
    return null;
  }
  const groups = { ...config.groups };
  delete groups[name];
  return { ...config, groups };
}

export function findDuplicateIdentities(config: AdminConfiguration) {
  const counts = new Map<string, number>();
  for (const admin of Object.values(config.admins)) {
    counts.set(admin.identity, (counts.get(admin.identity) ?? 0) + 1);
  }
  return new Set(
    [...counts].filter(([, count]) => count > 1).map(([identity]) => identity),
  );
}
