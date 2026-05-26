import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

export async function PATCH(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await context.params;
  const body = JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const response = await gatewayFetchWithRefresh(`/v1/tenants/${encodeURIComponent(id)}/theme/settings`, {
    method: "PATCH",
    body
  });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}
