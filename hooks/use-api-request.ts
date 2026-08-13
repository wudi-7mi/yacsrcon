"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";

export function useApiRequest() {
  const router = useRouter();
  return useCallback(
    <T>(input: RequestInfo | URL, init?: RequestInit) =>
      apiRequest<T>(input, {
        ...init,
        onUnauthorized: () => router.replace("/login"),
      }),
    [router],
  );
}
