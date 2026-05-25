import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "commerce_os_access";
export const REFRESH_COOKIE = "commerce_os_refresh";
export const FINGERPRINT_COOKIE = "commerce_os_session_fingerprint";
export const DEVICE_COOKIE = "commerce_os_device_id";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

export function getGatewayUrl() {
  return (process.env.CENTRAL_ADMIN_GATEWAY_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8088").replace(
    /\/$/,
    ""
  );
}

export function getCentralScope() {
  return {
    tenantId: process.env.CENTRAL_ADMIN_TENANT_ID ?? "platform",
    workspaceId: process.env.CENTRAL_ADMIN_WORKSPACE_ID ?? "central-admin"
  };
}

export async function setSessionCookies(session: {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionFingerprint?: string;
  readonly deviceId?: string;
}) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.accessToken, { ...cookieBase, maxAge: 15 * 60 });
  jar.set(REFRESH_COOKIE, session.refreshToken, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 });
  jar.set(FINGERPRINT_COOKIE, session.sessionFingerprint ?? randomUUID(), { ...cookieBase, maxAge: 30 * 24 * 60 * 60 });
  jar.set(DEVICE_COOKIE, session.deviceId ?? randomUUID(), { ...cookieBase, maxAge: 30 * 24 * 60 * 60 });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, FINGERPRINT_COOKIE, DEVICE_COOKIE]) {
    jar.set(name, "", { ...cookieBase, maxAge: 0 });
  }
}

export async function readSessionCookies() {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value,
    refreshToken: jar.get(REFRESH_COOKIE)?.value,
    sessionFingerprint: jar.get(FINGERPRINT_COOKIE)?.value,
    deviceId: jar.get(DEVICE_COOKIE)?.value
  };
}

export async function gatewayFetch(path: string, init: RequestInit = {}) {
  const session = await readSessionCookies();
  const scope = getCentralScope();
  const headers = new Headers(init.headers);
  headers.set("content-type", headers.get("content-type") ?? "application/json");
  headers.set("x-commerce-tenant", scope.tenantId);
  headers.set("x-commerce-workspace", scope.workspaceId);
  if (session.accessToken) {
    headers.set("authorization", `Bearer ${session.accessToken}`);
  }
  if (session.sessionFingerprint) {
    headers.set("x-commerce-session-fingerprint", session.sessionFingerprint);
  }
  if (session.deviceId) {
    headers.set("x-commerce-device-id", session.deviceId);
  }

  return fetch(`${getGatewayUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers
  });
}

export async function refreshSession(options: { readonly allowCookieMutation?: boolean } = {}) {
  const allowCookieMutation = options.allowCookieMutation ?? true;
  const session = await readSessionCookies();
  if (!session.refreshToken) {
    return false;
  }

  const scope = getCentralScope();
  const response = await fetch(`${getGatewayUrl()}/v1/auth/refresh`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-commerce-tenant": scope.tenantId,
      "x-commerce-workspace": scope.workspaceId
    },
    body: JSON.stringify({ refreshToken: session.refreshToken })
  });

  if (!response.ok) {
    if (allowCookieMutation) {
      await clearSessionCookies();
    }
    return false;
  }

  const payload = (await response.json()) as { readonly accessToken: string; readonly refreshToken: string };
  if (allowCookieMutation) {
    await setSessionCookies({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      ...(session.sessionFingerprint ? { sessionFingerprint: session.sessionFingerprint } : {}),
      ...(session.deviceId ? { deviceId: session.deviceId } : {})
    });
  }
  return true;
}

export async function gatewayFetchWithRefresh(
  path: string,
  init: RequestInit = {},
  options: { readonly allowCookieMutation?: boolean } = {}
) {
  const response = await gatewayFetch(path, init);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession(options);
  if (!refreshed || options.allowCookieMutation === false) {
    return response;
  }

  return gatewayFetch(path, init);
}
