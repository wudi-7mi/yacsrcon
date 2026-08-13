"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Map, Play, Search } from "lucide-react";
import type { ServerCatalog } from "@/lib/types";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";

export function MapsView({
  catalog,
  currentMap,
  onCommand,
}: {
  catalog: ServerCatalog;
  currentMap: string | null;
  onCommand: (c: string) => void;
}) {
  const [selectedModeId, setSelectedModeId] = useState(
    catalog.modes[0]?.id ?? "",
  );
  const [modeQuery, setModeQuery] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const selectedMode =
    catalog.modes.find((mode) => mode.id === selectedModeId) ??
    catalog.modes[0];
  const visibleModes = useMemo(() => {
    const query = modeQuery.trim().toLowerCase();
    if (!query) return catalog.modes;
    return catalog.modes.filter((mode) =>
      [mode.name, mode.displayNameZh, mode.config].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [catalog.modes, modeQuery]);
  const visibleMaps = useMemo(() => {
    const query = mapQuery.trim().toLowerCase();
    if (!selectedMode) return [];
    if (!query) return selectedMode.maps;
    return selectedMode.maps.filter((map) =>
      [map.name, map.workshopId ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [mapQuery, selectedMode]);

  if (!selectedMode) {
    return <Empty icon={Map} text="服务器目录中没有可用模式" />;
  }

  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 地图与模式"
        title="地图与模式"
        copy="从 GameModeManager 的实际配置中选择模式和地图。"
      />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">游戏模式</h2>
              <span className="text-xs text-[var(--muted)]">
                {catalog.modes.length} 个
              </span>
            </div>
            <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-[var(--muted)] focus-within:border-[var(--accent)]">
              <Search size={14} />
              <input
                value={modeQuery}
                onChange={(event) => setModeQuery(event.target.value)}
                placeholder="搜索模式或 CFG"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-2">
            {visibleModes.length ? (
              visibleModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setSelectedModeId(mode.id);
                    setMapQuery("");
                  }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left last:mb-0 ${selectedMode.id === mode.id ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-white"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {mode.displayNameZh}
                    </span>
                    <span className="mono mt-0.5 block truncate text-[10px] text-[var(--muted)]">
                      {mode.name} · {mode.config}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className={
                      selectedMode.id === mode.id
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted)]"
                    }
                  />
                </button>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-xs text-[var(--muted)]">
                没有匹配的模式
              </p>
            )}
          </div>
        </section>
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  {selectedMode.displayNameZh}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selectedMode.name} · {selectedMode.config}
                </p>
              </div>
              <button
                onClick={() => onCommand(`exec ${selectedMode.config}`)}
                className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[#15200d]"
              >
                <Play size={14} /> 载入此模式
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
              <span>
                默认地图：
                <strong className="mono font-normal text-white">
                  {selectedMode.defaultMap ?? "由服务器决定"}
                </strong>
              </span>
              <span>
                地图组：
                <strong className="mono font-normal text-white">
                  {selectedMode.mapGroups.join(", ") || "无"}
                </strong>
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">可用地图</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  当前模式共 {selectedMode.maps.length} 张
                </p>
              </div>
              <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-[var(--muted)] focus-within:border-[var(--accent)] sm:w-56">
                <Search size={14} />
                <input
                  value={mapQuery}
                  onChange={(event) => setMapQuery(event.target.value)}
                  placeholder="搜索地图或 Workshop ID"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[var(--muted)]"
                />
              </label>
            </div>
            {visibleMaps.length ? (
              <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {visibleMaps.map((map) => {
                  const isCurrent = currentMap === map.name;
                  return (
                    <button
                      key={map.workshopId ?? map.name}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onCommand(map.command)}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${isCurrent ? "border-[var(--accent)] bg-[#172513] text-white" : "border-[var(--line)] bg-[#11171d] hover:border-[var(--accent)]"}`}
                    >
                      <span className="min-w-0">
                        <span className="mono block truncate text-xs">
                          {map.name}
                        </span>
                        {map.workshopId && (
                          <span className="mt-1 block text-[10px] text-[var(--muted)]">
                            Workshop · {map.workshopId}
                          </span>
                        )}
                      </span>
                      {isCurrent ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--accent)]">
                          <Check size={13} /> 当前
                        </span>
                      ) : (
                        <ChevronRight
                          size={14}
                          className="shrink-0 text-[var(--muted)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--line)] py-12 text-center text-xs text-[var(--muted)]">
                {selectedMode.maps.length
                  ? "没有匹配的地图"
                  : "此模式的地图组中没有地图"}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
