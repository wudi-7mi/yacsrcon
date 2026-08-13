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

The web process does not receive general write access to `/home/steam`. Install the restricted helper once on the CS2 host, passing the operating-system user that runs YACSRCON:

```bash
sudo sh scripts/install-admin-helper.sh wudi7mi
```

The installer creates a root-owned `/usr/local/sbin/yacsrcon-admin-helper` and a sudoers rule limited to its `read` and `apply` actions. The helper only accesses `admins.json`, `admin_groups.json`, and `admin_overrides.json` in the fixed CounterStrikeSharp config directory. Every apply validates the complete document, writes through same-directory temporary files, and stores the previous files under `configs/backups/yacsrcon/`.

For a container deployment, install the helper on the host and expose it through a deliberately configured host-side service. Do not mount the Docker socket or grant the container unrestricted sudo access.

## Docker

Set `RCON_PASSWORD`, `ADMIN_PASSWORD`, and a random `AUTH_SECRET` in
`.env.local`, then run:

```bash
docker compose up -d --build
```

The container uses host networking so it can reach a CS2 RCON socket bound to
`127.0.1.1`. Session and audit data are persisted in the project's `data/`
directory. The entrypoint initializes that directory and then drops privileges;
set `PUID` and `PGID` in `.env.local` to the owner of the host directory when
they are not 1000. When omitted, the entrypoint defaults both values to 1000.

`SESSION_PATH` and `AUDIT_PATH` may be configured explicitly. Otherwise they
are derived beside `DATABASE_PATH` using its filename stem, regardless of its
extension. For example, `state.sqlite` produces `state.sessions.json` and
`state.jsonl`. Startup fails if any of the three paths resolve to the same
file.

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
journal.

## First phase scope

- Single admin login
- Live status, map, player count, latency and plugin checks
- Player list with kick actions
- CounterStrikeSharp administrator and permission-group management
- Map and mode/CFG shortcuts
- Full RCON console with command history in the session and confirmation for high-impact commands
- JSONL audit log
