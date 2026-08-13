"use client";

import { useCallback, useEffect, useState } from "react";
import { useApiRequest } from "@/hooks/use-api-request";
import type { DashboardData } from "@/lib/types";

const initialDashboard: DashboardData = {
  connected: false,
  latencyMs: null,
  status: null,
  players: [],
  plugins: [],
  meta: "",
};

export function useDashboardPolling(intervalMs = 15_000) {
  const request = useApiRequest();
  const [data, setData] = useState(initialDashboard);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      setData(
        await request<DashboardData>("/api/dashboard", {
          cache: "no-store",
          signal,
        }),
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setData((current) => ({
          ...current,
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      controller = new AbortController();
      await refresh(controller.signal);
      if (!stopped) timer = setTimeout(poll, intervalMs);
    };
    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, refresh]);

  return { data, loading, refresh };
}
