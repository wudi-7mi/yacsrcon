"use client";

import { useCallback } from "react";
import { apiRequest } from "@/lib/api-client";

export function useApiRequest(onUnauthorized?: () => void) {
  return useCallback(
    <T>(input: RequestInfo | URL, init?: RequestInit) =>
      apiRequest<T>(input, {
        ...init,
        onUnauthorized,
      }),
    [onUnauthorized],
  );
}
