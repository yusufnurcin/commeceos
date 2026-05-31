import { notFound, redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { OrderDetailPanel } from "@/components/order-detail-panel";
import type { CommerceOrderEventView, CommerceOrderItemView, CommerceOrderRefundView, CommerceOrderReturnView, CommerceOrderSyncJobView, CommerceOrderView, OrderMedusaHealthView } from "@/components/order-operations-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function OrderDetailPage({ params }: { readonly params: Promise<{ readonly orderId: string }> }) {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const { orderId } = await params; const response = await gatewayFetchWithRefresh(`/v1/orders/${encodeURIComponent(orderId)}`, {}, { allowCookieMutation: false });
  if (response.status === 401) redirect("/login"); if (response.status === 404) notFound();
  const payload = await readJson(response) as { readonly order: CommerceOrderView; readonly items?: readonly CommerceOrderItemView[]; readonly returns?: readonly CommerceOrderReturnView[]; readonly refunds?: readonly CommerceOrderRefundView[]; readonly events?: readonly CommerceOrderEventView[]; readonly syncJobs?: readonly CommerceOrderSyncJobView[]; readonly medusaHealth?: OrderMedusaHealthView | null };
  const item = findNavigationItemByHref("/orders") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader item={{ ...item, status: "runtime-ready", label: payload.order.orderId, href: `/orders/${encodeURIComponent(orderId)}`, description: "Sipariş kalemlerini, iç ödeme ve fulfillment durumlarını, iade/refund taleplerini ve Medusa sync işlerini yönetin." }} principal={session.principal} /><OrderDetailPanel initialEvents={payload.events ?? []} initialItems={payload.items ?? []} initialOrder={payload.order} initialRefunds={payload.refunds ?? []} initialReturns={payload.returns ?? []} initialSyncJobs={payload.syncJobs ?? []} medusaHealth={payload.medusaHealth} /></AdminShell>;
}
