export type ServerStatus = {
  hostname: string;
  address: string;
  map: string;
  players: number;
  maxPlayers: number;
  bots: number;
  version?: string;
  raw: string;
};

export type Player = {
  userid: string;
  name: string;
  steamId: string;
  time: string;
  ping: number;
  loss: number;
  state: string;
  address: string;
};

export type PluginInfo = { name: string; version?: string; state?: string };

export type DashboardData = {
  connected: boolean;
  latencyMs: number | null;
  status: ServerStatus | null;
  players: Player[];
  plugins: PluginInfo[];
  meta: string;
  error?: string;
};

export type ServerMap = {
  name: string;
  workshopId?: string;
  command: string;
};

export type ServerMode = {
  id: string;
  name: string;
  displayNameZh: string;
  config: string;
  defaultMap: string | null;
  mapGroups: string[];
  maps: ServerMap[];
};

export type ServerCatalog = {
  generatedAt: string;
  source: { gameModeManager: string; mapGroups: string };
  modes: ServerMode[];
};

export type CssAdmin = {
  identity: string;
  immunity?: number;
  flags?: string[];
  groups?: string[];
  command_overrides?: Record<string, boolean>;
};

export type CssAdminGroup = {
  flags: string[];
  immunity?: number;
};

export type AdminConfiguration = {
  admins: Record<string, CssAdmin>;
  groups: Record<string, CssAdminGroup>;
  overrides: Record<string, unknown>;
  backupDirectory?: string;
};
