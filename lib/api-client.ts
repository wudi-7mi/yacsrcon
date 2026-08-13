export class ApiError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(
    message: string,
    status: number,
    payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type ApiRequestOptions = RequestInit & {
  onUnauthorized?: () => void;
};

function messageFromPayload(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { onUnauthorized, ...init } = options;
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "网络请求失败",
      0,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;
  if (response.status !== 204) {
    payload = contentType.includes("application/json")
      ? await response.json().catch(() => undefined)
      : await response.text().catch(() => undefined);
  }

  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const fallback =
      typeof payload === "string" && payload.trim()
        ? payload
        : `请求失败（HTTP ${response.status}）`;
    throw new ApiError(
      messageFromPayload(payload, fallback),
      response.status,
      payload,
    );
  }

  return payload as T;
}
