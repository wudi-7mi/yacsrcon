import type {
  PluginCenterResult,
  PluginInfo,
  PluginIntegration,
  PluginInstallState,
} from "./types.ts";

type PluginDefinition = Omit<PluginIntegration, "state" | "version"> & {
  runtimeNames: string[];
};

export const PLUGIN_CATALOG: PluginDefinition[] = [
  {
    id: "announcement-broadcaster",
    directory: "CS2AnnouncementBroadcaster",
    name: "公告广播",
    description: "管理连接、回合、定时和命令触发消息。",
    runtimeNames: ["CS2 Announcement Broadcaster"],
    features: ["结构化消息", "条件显示", "热重载"],
    managed: true,
  },
  {
    id: "custom-votes",
    directory: "CS2-CustomVotes",
    name: "自定义投票",
    description: "创建投票入口、选项和获胜后执行的服务器动作。",
    runtimeNames: ["Custom Votes"],
    features: ["投票构建器", "权限", "热重载"],
    managed: true,
  },
  {
    id: "gamemode-manager",
    directory: "GameModeManager",
    name: "模式与 RTV",
    description: "控制暖场、RTV、时间限制和模式设置。",
    runtimeNames: ["GameModeManager"],
    features: ["RTV", "暖场", "设置开关"],
    managed: true,
  },
  {
    id: "inventory-simulator",
    directory: "InventorySimulator",
    name: "玩家库存",
    description: "查看玩家装备并连接 Inventory Simulator 编辑器。",
    runtimeNames: ["InventorySimulator"],
    features: ["武器与饰品", "在线玩家", "外部编辑"],
    managed: true,
  },
  {
    id: "map-configurator",
    directory: "MapConfigurator",
    name: "地图专属配置",
    description: "管理地图、前缀和回合强制 CFG。",
    runtimeNames: ["[Custom] Map Configurator", "Map Configurator"],
    features: ["地图 CFG", "前缀 CFG"],
    managed: false,
  },
  {
    id: "simple-admin",
    directory: "SimpleAdmin",
    name: "SimpleAdmin",
    description: "玩家处罚、封禁记录和管理员操作。",
    runtimeNames: ["SimpleAdmin"],
    features: ["处罚", "封禁", "管理员"],
    managed: true,
  },
  {
    id: "matchzy",
    directory: "MatchZy",
    name: "MatchZy",
    description: "竞技比赛、队伍、BP、统计与 Demo。",
    runtimeNames: ["MatchZy"],
    features: ["比赛", "Get5 Panel", "统计"],
    managed: false,
  },
  {
    id: "sharptimer",
    directory: "SharpTimer",
    name: "SharpTimer",
    description: "跑图计时、个人纪录和排行榜。",
    runtimeNames: ["SharpTimer"],
    features: ["计时", "排行榜", "地图纪录"],
    managed: false,
  },
];

export function buildPluginCenter(
  directories: { active: string[]; disabled: string[] },
  runtime: PluginInfo[],
): PluginCenterResult {
  const active = new Set(directories.active);
  const disabled = new Set(directories.disabled);
  const normalizedRuntime = runtime.map((plugin) => ({
    ...plugin,
    normalized: plugin.name.trim().toLowerCase(),
  }));
  const plugins = PLUGIN_CATALOG.map(({ runtimeNames, ...definition }) => {
    const loaded = normalizedRuntime.find((plugin) =>
      runtimeNames.some((name) => plugin.normalized === name.toLowerCase()),
    );
    const state: PluginInstallState = loaded || active.has(definition.directory)
      ? "loaded"
      : disabled.has(definition.directory)
        ? "disabled"
        : "missing";
    return { ...definition, state, version: loaded?.version };
  });
  return {
    plugins,
    counts: {
      loaded: plugins.filter((plugin) => plugin.state === "loaded").length,
      disabled: plugins.filter((plugin) => plugin.state === "disabled").length,
      missing: plugins.filter((plugin) => plugin.state === "missing").length,
    },
  };
}
