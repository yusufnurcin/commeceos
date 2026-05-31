import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { OrderRefundsPanel } from "@/components/order-refunds-panel";
import type { CommerceOrderRefundView } from "@/components/order-operations-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function OrderRefundsPage() {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const response = await gatewayFetchWithRefresh("/v1/orders/refunds", {}, { allowCookieMutation: false }); if (response.status === 401) redirect("/login");
  const payload = await readJson(response) as { readonly refunds?: readonly CommerceOrderRefundView[] };
  const item = findNavigationItemByHref("/orders/refunds") ?? findNavigationItemByHref("/orders") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader actions={<Link href="/orders">Siparişler</Link>} item={{ ...item, status: "runtime-ready", description: "Refund taleplerini inceleyin. Bu yüzey yalnızca iç durum kararını kaydeder; ödeme transferi yapmaz." }} principal={session.principal} /><OrderRefundsPanel initialRefunds={payload.refunds ?? []} /></AdminShell>;
}
