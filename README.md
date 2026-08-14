# YACSRCON

Modern single-server web control room for the CS2 modded server described in `cs2-modded-server.md`.

## Local development

```bash
npm install
cp .env.example .env.local
# Set RCON_PASSWORD and ADMIN_PASSWORD in .env.local
npm run dev
```

Open http://localhost:21590. The app keeps the RCON secret server-side, maintains a reconnecting session, and writes an audit trail to `data/yacsrcon.jsonl`.

RCON authentication and commands have an explicit 4-second deadline by default. Set `RCON_TIMEOUT_MS` when a remote server needs a different value. A timeout disconnects the stale socket so later commands can reconnect; because the server might have received a timed-out command, the UI reports its outcome as unknown rather than encouraging an unsafe retry.

## Sync maps and modes

The checked-in `config/server-catalog.json` snapshot is generated from GameModeManager and `gamemodes_server.txt`, so the web process does not need access to the Steam user's files. After changing either server config, refresh the snapshot with:

```bash
npm run sync:catalog
```

The script uses the deployment paths under `/home/steam/cs2/game/csgo` by default and falls back to non-interactive `sudo -u steam` when necessary. Use `--manager`, `--map-groups`, and `--output` to supply different paths.

## CounterStrikeSharp administrator helper

The web process does not receive general write access to `/home/steam`. Install the restricted helper on the CS2 host, passing the operating-system user that runs YACSRCON:

```bash
sudo sh scripts/install-admin-helper.sh wudi7mi
```

Run the installer again after upgrading YACSRCON. It replaces the root-owned
helper and its sudoers rule so newly added restricted actions, such as ban-list
access, are available to the updated application.

The installer creates a root-owned `/usr/local/sbin/yacsrcon-admin-helper` and
a sudoers rule limited to fixed configuration, CFG, ban-list, and CS2 process actions. The helper
only accesses `admins.json`, `admin_groups.json`, and `admin_overrides.json` in
the fixed CounterStrikeSharp config directory, plus read-only access to
SimpleAdmin's fixed `bans.db` path. Every administrator configuration apply
validates the complete document, writes through same-directory temporary
files, and stores the previous files under `configs/backups/yacsrcon/`. Ban and
unban writes always use SimpleAdmin RCON commands; the helper never writes its
SQLite database.

The configuration page exposes only four fixed CFG identifiers: `server.cfg`,
`on_boot.cfg`, `custom_all.cfg`, and `custom_bots.cfg`. The browser and API never
accept filesystem paths. Saving validates the content and current SHA-256 hash,
shows a diff for confirmation, then writes both the persistent copy under
`/home/steam/cs2/custom_files/cfg` and the active copy under
`/home/steam/cs2/game/csgo/cfg`. Each save and rollback first stores the current
version under `/home/steam/cs2/custom_files/backups/yacsrcon-cfg`. Set
`CFG_BACKUP_LIMIT` from 5 to 200 to control how many versions are retained per
file; older versions are deleted after a new backup is created.

The server operations page is tied to the reference host deployment under
`/home/wudi7mi/cs2-env` and `/home/steam/cs2`. The helper starts only the fixed
CS2 binary, stops only a verified `steam`-owned CS2 process, and returns only
the tail of the fixed `server.log` after redacting launch secrets. Re-run the
helper installer after this upgrade before opening that page.

The audit center reads up to 200 recent matching records and skips malformed
JSONL lines without hiding valid entries. The active audit file rotates at 5
MiB by default and retains two older files. Set `AUDIT_MAX_BYTES` to adjust the
threshold.

Runtime monitoring samples player count, map, RCON latency, and connection state
every 30 seconds independently of the browser. It retains 24 hours in a
permission-restricted JSONL sidecar and presents 1, 6, 12, or 24-hour trends.
The current page flags RCON outages and high latency. Set `METRICS_PATH` to
override the default `<database-name>.metrics.jsonl` path.

Set `WEBHOOK_URL` to enable generic JSON alerts. `WEBHOOK_TOKEN`, when present,
is sent as an `Authorization: Bearer` value. Disconnect and high-latency alerts
require consecutive failed samples and use a reminder cooldown; recovery events
are sent as soon as a healthy sample arrives. Thresholds are controlled by
`ALERT_DISCONNECT_SAMPLES`, `ALERT_HIGH_LATENCY_MS`,
`ALERT_HIGH_LATENCY_SAMPLES`, and `ALERT_COOLDOWN_MINUTES`. Delivery state is
stored in the permission-restricted `ALERT_STATE_PATH` sidecar so service
restarts do not reset deduplication.

The public `/api/health` endpoint returns `200` only when monitoring is fresh and
RCON is connected; otherwise it returns `503` without exposing credentials or
internal paths. The operations page shows application data, CFG backup, and
administrator backup usage. Its recovery export contains current administrator
configuration, the four managed CFG files, bans, recent audit entries, and
24-hour monitoring data. Applying that package restores only administrator and
CFG configuration with automatic rollback on a detected failure. It never
overwrites sessions, environment secrets, audit files, monitoring history, or
the SimpleAdmin database. Keep `.env.local` in a separate protected backup for
complete host recovery.

For a container deployment, install the helper on the host and expose it through a deliberately configured host-side service. Do not mount the Docker socket or grant the container unrestricted sudo access.

## Docker

Set `RCON_PASSWORD`, `ADMIN_PASSWORD`, and a random `AUTH_SECRET` in
`.env.local`, then run:

```bash
docker compose up -d --build
```

The container uses host networking so it can reach a CS2 RCON socket bound to
`127.0.1.1`. Session, audit, and monitoring data are persisted in the project's `data/`
directory. The entrypoint initializes that directory and then drops privileges;
set `PUID` and `PGID` in `.env.local` to the owner of the host directory when
they are not 1000. When omitted, the entrypoint defaults both values to 1000.

`SESSION_PATH`, `AUDIT_PATH`, `METRICS_PATH`, and `ALERT_STATE_PATH` may be configured explicitly. Otherwise they
are derived beside `DATABASE_PATH` using its filename stem, regardless of its
extension. For example, `state.sqlite` produces `state.sessions.json`,
`state.jsonl`, `state.metrics.jsonl`, and `state.alerts.json`. Startup fails if
any of the five paths resolve to the same file.

## systemd

For a host deployment, build the app and install the included service:

```bash
npm run build
sudo install -m 0644 deploy/yacsrcon.service /etc/systemd/system/yacsrcon.service
sudo systemctl daemon-reload
sudo systemctl enable --now yacsrcon
```

The build prepares Next.js's standalone output. The service runs that production
server on port `21590`, restarts on failure, and writes logs to the system
journal. The included unit pins all persistent sidecars to the repository's
`data/` directory because the standalone server changes its runtime working
directory.

## First phase scope

- Single admin login
- Live status, map, player count, latency and plugin checks
- Online kick/slay/ban actions, offline SteamID64 bans, and SimpleAdmin ban management
- CounterStrikeSharp administrator and permission-group management
- Map and mode/CFG shortcuts
- Full RCON console with command history in the session and confirmation for high-impact commands
- JSONL audit log
- Restricted CFG editing with validation, diff confirmation, backups, and rollback
- 24-hour server health history with short-term trends and in-app alerts
- Webhook alerts with sustained thresholds, recovery notifications, and cooldowns
- Health checks, storage usage, bounded CFG backups, and logical recovery packages
