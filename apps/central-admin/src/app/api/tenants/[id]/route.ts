import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await context.params;
  const response = await gatewayFetchWithRefresh(`/v1/tenants/${encodeURIComponent(id)}`);
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}
