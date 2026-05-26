import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly key: string }> }) {
  const { key } = await context.params;
  const response = await gatewayFetchWithRefresh(`/v1/themes/${encodeURIComponent(key)}`);
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}
