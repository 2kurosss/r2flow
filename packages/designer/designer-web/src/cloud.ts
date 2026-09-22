/** Cloud-mode session: same-origin Cloud API with bearer + cookie refresh.
 *
 * Mirrors the orchestrator frontend pattern: the access token lives in
 * localStorage, refresh rides the httpOnly cookie (shared across
 * cloud/designer hosts via COOKIE_DOMAIN=.r2flow.ru). On 401 the client
 * tries one cookie refresh, then surfaces the login dialog.
 */

/** True in the bundle served from designer.r2flow.ru (VITE_CLOUD_MODE=1). */
export const CLOUD_MODE: boolean = import.meta.env.VITE_CLOUD_MODE === "1";

const ACCESS_KEY = "r2flow.designer.access_token";

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(ACCESS_KEY, token);
    else localStorage.removeItem(ACCESS_KEY);
  } catch {
    /* private mode — session-only */
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("session expired — please log in again");
    this.name = "UnauthorizedError";
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Subscribe to terminal-401 events (login dialog). Returns unsubscribe. */
export function onUnauthorized(fn: UnauthorizedHandler): () => void {
  unauthorizedHandler = fn;
  return () => {
    if (unauthorizedHandler === fn) unauthorizedHandler = null;
  };
}

function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}

async function tryCookieRefresh(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: "" }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      access_token?: unknown;
    } | null;
    return typeof data?.access_token === "string" ? data.access_token : null;
  } catch {
    return null;
  }
}

/** Same-origin fetch with bearer auth + one cookie-refresh retry. */
export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const send = (token: string | null) =>
    fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let res = await send(getAccessToken());
  if (res.status !== 401) return res;
  const refreshed = await tryCookieRefresh();
  if (refreshed) {
    setAccessToken(refreshed);
    return send(refreshed);
  }
  setAccessToken(null);
  notifyUnauthorized();
  throw new UnauthorizedError();
}

export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email.trim(), password });
  const res = await fetch("/api/auth/login", { method: "POST", body });
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as {
      detail?: unknown;
    } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : "login failed");
  }
  const data = (await res.json()) as { access_token?: unknown };
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("login failed: no access token");
  }
  setAccessToken(data.access_token);
}

export async function register(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as {
      detail?: unknown;
    } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : "registration failed");
  }
  const data = (await res.json()) as { access_token?: unknown };
  if (typeof data.access_token === "string" && data.access_token) {
    setAccessToken(data.access_token);
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* best effort */
  }
  setAccessToken(null);
}
