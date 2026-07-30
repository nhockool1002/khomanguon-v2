export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiFetchOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: RequestInit) {
  // FormData (upload file) phải để browser tự set Content-Type kèm boundary — không ghi đè.
  const isFormData = options.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
}

// Access token sống trong bộ nhớ (không localStorage, tránh XSS đọc trộm). Khi hết hạn (401),
// thử refresh 1 lần qua cookie httpOnly rồi lặp lại request gốc — người dùng không nhận ra.
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry && path !== "/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, options);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : null) ?? `Lỗi ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

let refreshPromise: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const res = await rawFetch("/auth/refresh", { method: "POST" });
      if (!res.ok) return false;
      const body = (await res.json()) as { accessToken: string | null };
      if (!body.accessToken) return false;
      setAccessToken(body.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
