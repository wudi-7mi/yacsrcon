#!/bin/sh
set -eu

app_user="${1:-$(id -un)}"
case "$app_user" in
  *[!a-zA-Z0-9_-]*|'') echo "Invalid application user" >&2; exit 1 ;;
esac

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
helper=/usr/local/sbin/yacsrcon-admin-helper
sudoers=/etc/sudoers.d/yacsrcon-admin-helper
temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT

install -o root -g root -m 0755 "$project_dir/system/yacsrcon-admin-helper" "$helper"
printf '%s ALL=(root) NOPASSWD: %s read, %s apply, %s bans, %s cfg, %s plugins, %s storage-status, %s server-status, %s server-logs, %s server-start, %s server-stop, %s server-restart\n' \
  "$app_user" "$helper" "$helper" "$helper" "$helper" "$helper" "$helper" "$helper" "$helper" "$helper" "$helper" "$helper" > "$temporary"
chmod 0440 "$temporary"
visudo -cf "$temporary"
install -o root -g root -m 0440 "$temporary" "$sudoers"

echo "Installed $helper for user $app_user"
