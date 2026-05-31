import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

async function forward(method: "GET" | "POST", context: { readonly params: Promise<{ readonly action: string }> }) {
  const { action } = await context.params;
  if (!["status", "seed", "cleanup"].includes(action)) {
    return NextResponse.json({ status: "demo_route_not_found" }, { status: 404 });
  }
  const response = await gatewayFetchWithRefresh(`/v1/demo/${action}`, { method });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly action: string }> }) {
  return forward("GET", context);
}

export async function POST(_request: Request, context: { readonly params: Promise<{ readonly action: string }> }) {
  return forward("POST", context);
}
