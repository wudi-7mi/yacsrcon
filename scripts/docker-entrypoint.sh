#!/bin/sh
set -eu

app_uid="${PUID:-1000}"
app_gid="${PGID:-1000}"
data_dir=/app/data

case "$app_uid" in
  *[!0-9]*|'') echo "PUID must be a positive integer" >&2; exit 1 ;;
esac
case "$app_gid" in
  *[!0-9]*|'') echo "PGID must be a positive integer" >&2; exit 1 ;;
esac
if [ "$app_uid" -eq 0 ] || [ "$app_gid" -eq 0 ]; then
  echo "PUID and PGID must not be 0" >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  group_name=$(awk -F: -v gid="$app_gid" '$3 == gid { print $1; exit }' /etc/group)
  if [ -z "$group_name" ]; then
    group_name=yacsrcon
    addgroup -S -g "$app_gid" "$group_name"
  fi
  if ! awk -F: -v uid="$app_uid" '$3 == uid { found=1 } END { exit !found }' /etc/passwd; then
    adduser -S -D -H -u "$app_uid" -G "$group_name" yacsrcon
  fi
  mkdir -p "$data_dir"
  chown -R "$app_uid:$app_gid" "$data_dir"
  chmod 0700 "$data_dir"
  exec su-exec "$app_uid:$app_gid" "$@"
fi

if [ "$(id -u)" -ne "$app_uid" ] || [ "$(id -g)" -ne "$app_gid" ]; then
  echo "Entrypoint must run as root or as PUID:PGID" >&2
  exit 1
fi
mkdir -p "$data_dir"
chmod 0700 "$data_dir"
exec "$@"
