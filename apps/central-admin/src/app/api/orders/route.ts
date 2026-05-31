import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

async function forward(request: Request, method: string) {
  const body = method === "GET" ? undefined : JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const response = await gatewayFetchWithRefresh("/v1/orders", { method, ...(body ? { body } : {}) });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request) {
  return forward(request, "GET");
}

export async function POST(request: Request) {
  return forward(request, "POST");
}
