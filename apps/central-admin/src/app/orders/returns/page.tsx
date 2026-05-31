import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { OrderReturnsPanel } from "@/components/order-returns-panel";
import type { CommerceOrderReturnView } from "@/components/order-operations-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function OrderReturnsPage() {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const response = await gatewayFetchWithRefresh("/v1/orders/returns", {}, { allowCookieMutation: false }); if (response.status === 401) redirect("/login");
  const payload = await readJson(response) as { readonly returns?: readonly CommerceOrderReturnView[] };
  const item = findNavigationItemByHref("/orders/returns") ?? findNavigationItemByHref("/orders") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader actions={<Link href="/orders">Siparişler</Link>} item={{ ...item, status: "runtime-ready", description: "Gerçek iade taleplerini inceleyin; onay ve ret kararlarını audit geçmişiyle birlikte yönetin." }} principal={session.principal} /><OrderReturnsPanel initialReturns={payload.returns ?? []} /></AdminShell>;
}
