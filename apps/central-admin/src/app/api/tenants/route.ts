import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

export async function GET() {
  const response = await gatewayFetchWithRefresh("/v1/tenants");
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const response = await gatewayFetchWithRefresh("/v1/tenants", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}
