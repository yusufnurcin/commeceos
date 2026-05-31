import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { OrderOperationsPanel, type CommerceOrderModuleView, type CommerceOrderSyncJobView, type CommerceOrderView, type OrderMedusaHealthView } from "@/components/order-operations-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function OrdersPage() {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const [orderResponse, jobResponse] = await Promise.all([gatewayFetchWithRefresh("/v1/orders", {}, { allowCookieMutation: false }), gatewayFetchWithRefresh("/v1/orders/medusa-sync-jobs", {}, { allowCookieMutation: false })]);
  if (orderResponse.status === 401 || jobResponse.status === 401) redirect("/login");
  const orderPayload = await readJson(orderResponse) as { readonly orders?: readonly CommerceOrderView[]; readonly module?: CommerceOrderModuleView | null; readonly medusaHealth?: OrderMedusaHealthView | null };
  const jobPayload = await readJson(jobResponse) as { readonly syncJobs?: readonly CommerceOrderSyncJobView[] };
  const item = findNavigationItemByHref("/orders") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader actions={<><Link href="/orders/returns">İadeler</Link><Link href="/orders/refunds">Refundlar</Link></>} item={{ ...item, status: "runtime-ready", description: "Gerçek sipariş kayıtlarını, iç operasyon durumlarını ve kontrollü Medusa order sync kuyruğunu yönetin." }} principal={session.principal} /><OrderOperationsPanel initialOrders={orderPayload.orders ?? []} initialSyncJobs={jobPayload.syncJobs ?? []} medusaHealth={orderPayload.medusaHealth} module={orderPayload.module} /></AdminShell>;
}
