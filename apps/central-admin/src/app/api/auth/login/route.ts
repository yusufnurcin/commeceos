import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCentralScope, getGatewayUrl, setSessionCookies } from "@/lib/gateway-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { readonly email?: string; readonly password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ status: "invalid_payload" }, { status: 422 });
  }

  const scope = getCentralScope();
  const sessionFingerprint = randomUUID();
  const deviceId = randomUUID();
  const response = await fetch(`${getGatewayUrl()}/v1/auth/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-commerce-tenant": scope.tenantId,
      "x-commerce-workspace": scope.workspaceId,
      "x-commerce-session-fingerprint": sessionFingerprint,
      "x-commerce-device-id": deviceId,
      "user-agent": request.headers.get("user-agent") ?? "central-admin"
    },
    body: JSON.stringify({ email, password, sessionFingerprint, deviceFingerprint: deviceId })
  });

  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const tokens = payload as { readonly accessToken: string; readonly refreshToken: string; readonly sessionFingerprint?: string };
  await setSessionCookies({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionFingerprint: tokens.sessionFingerprint ?? sessionFingerprint,
    deviceId
  });

  return NextResponse.json({ status: "ok" });
}
