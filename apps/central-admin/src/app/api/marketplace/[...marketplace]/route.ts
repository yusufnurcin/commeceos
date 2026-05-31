import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

function marketplacePath(parts: readonly string[]) {
  return `/v1/marketplace/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function forward(
  request: Request,
  context: { readonly params: Promise<{ readonly marketplace: readonly string[] }> },
  method: string
) {
  const { marketplace } = await context.params;
  if (!marketplace.length) {
    return NextResponse.json({ status: "marketplace_route_not_found" }, { status: 404 });
  }

  const body =
    method === "GET"
      ? undefined
      : JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const response = await gatewayFetchWithRefresh(marketplacePath(marketplace), {
    method,
    ...(body ? { body } : {})
  });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly marketplace: readonly string[] }> }
) {
  return forward(request, context, "GET");
}

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly marketplace: readonly string[] }> }
) {
  return forward(request, context, "POST");
}

export async function PATCH(
  request: Request,
  context: { readonly params: Promise<{ readonly marketplace: readonly string[] }> }
) {
  return forward(request, context, "PATCH");
}
