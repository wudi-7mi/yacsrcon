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

export type PluginInstallState = "loaded" | "disabled" | "missing";

export type PluginIntegration = {
  id: string;
  directory: string;
  name: string;
  description: string;
  state: PluginInstallState;
  version?: string;
  features: string[];
  managed: boolean;
};

export type PluginCenterResult = {
  plugins: PluginIntegration[];
  counts: Record<PluginInstallState, number>;
};

export type AnnouncementCondition = {
  flag: "CS2AB_flag_1" | "CS2AB_flag_2" | "CS2AB_flag_3" | "CS2AB_flag_4" | "CS2AB_flag_5";
  op: 0 | 1 | 2 | 3;
  value: number;
};

export type AnnouncementMessage = {
  msg: string;
  admin?: boolean;
  cond?: AnnouncementCondition;
  delay?: number;
  cmd?: string;
  timer?: number;
  [key: string]: unknown;
};

export type AnnouncementConfig = {
  OnPlayerConnectMsgs: AnnouncementMessage[];
  OnAdminConnectMsgs: AnnouncementMessage[];
  OnRoundStartMsgs: AnnouncementMessage[];
  OnCommandMsgs: AnnouncementMessage[];
  TimerMsgs: AnnouncementMessage[];
};

export type AnnouncementDocument = {
  config: AnnouncementConfig;
  hash: string;
  persisted: boolean;
  modifiedAt: string;
  backupId?: string;
  reloadWarning?: string;
};

export type CustomVoteOption = {
  Text: string;
  Commands: string[];
};

export type CustomVote = {
  Command: string;
  CommandAliases: string[];
  Description: string;
  TimeToVote: number;
  Options: Record<string, CustomVoteOption>;
  DefaultOption: string;
  Style: "center" | "chat";
  MinVotePercentage: number;
  Permission: { RequiresAll: boolean; Permissions: string[] };
};

export type CustomVotesConfig = {
  CustomVotesEnabled: boolean;
  VoteCooldown: number;
  ChatPrefix: string;
  ForceStyle: "none" | "center" | "chat";
  CustomVotes: CustomVote[];
  ConfigVersion: 2;
};

export type CustomVotesDocument = {
  config: CustomVotesConfig;
  hash: string;
  persisted: boolean;
  modifiedAt: string;
  backupId?: string;
  reloadWarning?: string;
};

export type GameModeManagerStatus = {
  version: number;
  rtv: {
    enabled: boolean;
    duration: number;
    maxExtends: number;
    endOfMapVote: boolean;
    includeModes: boolean;
  };
  warmup: {
    enabled: boolean;
    time: number;
    modes: Array<{ name: string; config: string }>;
  };
  settings: string[];
};

export type PluginActionResult = {
  ok: true;
  command: string;
  response: string;
};

export type InventoryItemSummary = {
  uid: string;
  itemId: string | null;
  name: string | null;
  nameTag: string | null;
  model: string | null;
  wear: number | null;
  statTrak: number | null;
  equipped: string[];
  raw: Record<string, unknown>;
};

export type InventorySimulatorResult = {
  steamId: string;
  serviceUrl: string;
  inventory: InventoryItemSummary[];
  equipped: InventoryItemSummary[];
  counts: { inventory: number; equipped: number };
};

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

export type BanRecord = {
  steamId: string;
  playerName: string | null;
  minutes: number;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
};

export type AuditEntry = {
  at: string;
  action: string;
  [key: string]: unknown;
};

export type AuditResult = {
  entries: AuditEntry[];
  malformed: number;
};

export type ServerProcessStatus = {
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  uptimeSeconds: number | null;
  management: "fixed-script";
};

export type ServerLogResult = {
  status: ServerProcessStatus;
  lines: string[];
};

export type ManagedCfgSummary = {
  id: string;
  label: string;
  filename: string;
  hash: string;
  persisted: boolean;
  modifiedAt: string;
};

export type ManagedCfgVersion = {
  id: string;
  createdAt: string;
  size: number;
  hash: string;
};

export type ManagedCfgDocument = ManagedCfgSummary & {
  content: string;
  history: ManagedCfgVersion[];
  backupId?: string;
};

export type MetricSample = {
  at: string;
  connected: boolean;
  players: number;
  maxPlayers: number;
  map: string | null;
  latencyMs: number | null;
  error?: string;
};

export type MonitoringResult = {
  samples: MetricSample[];
  summary: {
    availabilityPercent: number;
    disconnects: number;
    averageLatencyMs: number | null;
    peakPlayers: number;
    currentAlert: "disconnected" | "high_latency" | null;
  };
};

export type AlertKind = "disconnected" | "high_latency";
export type AlertEvent = AlertKind | "recovered" | "latency_recovered" | "test";

export type AlertStatus = {
  enabled: boolean;
  destination: string | null;
  active: AlertKind | null;
  lastSentAt: string | null;
  thresholds: {
    disconnectSamples: number;
    highLatencyMs: number;
    highLatencySamples: number;
    cooldownMinutes: number;
  };
};

export type StorageUsage = { files: number; bytes: number };

export type MaintenanceStatus = {
  filesystems: {
    application: { totalBytes: number; freeBytes: number };
    cs2: { totalBytes: number; freeBytes: number };
  };
  cfgBackups: StorageUsage;
  adminBackups: StorageUsage;
  applicationData: StorageUsage;
  cfgBackupLimit: number;
  health: HealthResult;
};

export type HealthResult = {
  status: "ok" | "degraded";
  at: string;
  uptimeSeconds: number;
  checks: {
    web: "ok";
    monitoring: "ok" | "stale" | "missing" | "error";
    rcon: "connected" | "disconnected" | "unknown";
  };
};

export type RecoveryExport = {
  format: "yacsrcon-recovery-v1";
  generatedAt: string;
  serverName: string;
  admins: AdminConfiguration;
  configs: ManagedCfgDocument[];
  bans: BanRecord[] | null;
  monitoring: MonitoringResult;
  audit: AuditResult;
  warnings: string[];
};

export type RecoveryPayload = {
  format: RecoveryExport["format"];
  admins: AdminConfiguration;
  configs: Array<Pick<ManagedCfgDocument, "id" | "content">>;
};

export type RecoveryResult = {
  ok: true;
  adminCount: number;
  configCount: number;
  reloadWarning?: string;
};
