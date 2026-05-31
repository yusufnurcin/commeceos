import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

function ordersPath(parts: readonly string[]) {
  return `/v1/orders/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function forward(
  request: Request,
  context: { readonly params: Promise<{ readonly orders: readonly string[] }> },
  method: string
) {
  const { orders } = await context.params;
  if (!orders.length) {
    return NextResponse.json({ status: "order_route_not_found" }, { status: 404 });
  }
  const body = method === "GET" ? undefined : JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const response = await gatewayFetchWithRefresh(ordersPath(orders), { method, ...(body ? { body } : {}) });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request, context: { readonly params: Promise<{ readonly orders: readonly string[] }> }) {
  return forward(request, context, "GET");
}

export async function POST(request: Request, context: { readonly params: Promise<{ readonly orders: readonly string[] }> }) {
  return forward(request, context, "POST");
}

export async function PATCH(request: Request, context: { readonly params: Promise<{ readonly orders: readonly string[] }> }) {
  return forward(request, context, "PATCH");
}
