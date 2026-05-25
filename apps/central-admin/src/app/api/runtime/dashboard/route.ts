import { NextResponse } from "next/server";
import { getGatewayUrl, gatewayFetchWithRefresh } from "@/lib/gateway-session";

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "unavailable" }));
}

export async function GET() {
  const me = await gatewayFetchWithRefresh("/v1/auth/me");
  if (!me.ok) {
    return NextResponse.json(await readJson(me), { status: me.status });
  }

  const [healthMatrix, operations, tenants, queue, audit, medusaHealth] = await Promise.all([
    fetch(`${getGatewayUrl()}/runtime/health-matrix`, { cache: "no-store" }).then(readJson),
    gatewayFetchWithRefresh("/v1/control-center/operations").then(readJson),
    gatewayFetchWithRefresh("/v1/tenants").then(readJson),
    gatewayFetchWithRefresh("/v1/queues/runtime").then(readJson),
    gatewayFetchWithRefresh("/v1/audit/runtime").then(readJson),
    fetch(`${process.env.MEDUSA_PUBLIC_URL ?? "http://localhost:9000"}/health`, { cache: "no-store" }).then(readJson)
  ]);

  return NextResponse.json({
    status: "ok",
    me: await readJson(me),
    healthMatrix,
    medusaHealth,
    operations,
    tenants,
    queue,
    audit
  });
}
