import { NextResponse } from "next/server";
import { clearSessionCookies, gatewayFetchWithRefresh } from "@/lib/gateway-session";

export async function POST() {
  await gatewayFetchWithRefresh("/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  }).catch(() => undefined);
  await clearSessionCookies();
  return NextResponse.json({ status: "ok" });
}
