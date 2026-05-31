import { notFound, redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { CatalogProductDetailPanel } from "@/components/catalog-product-detail-panel";
import type { CatalogProductView, CatalogSyncJobView, CatalogVariantView, MedusaHealthView } from "@/components/catalog-products-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

interface CatalogEventView { readonly id: string; readonly event_type: string; readonly created_at: string; }
export default async function CatalogProductDetailPage({ params }: { readonly params: Promise<{ readonly productId: string }> }) {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const { productId } = await params; const response = await gatewayFetchWithRefresh(`/v1/catalog/products/${encodeURIComponent(productId)}`, {}, { allowCookieMutation: false });
  if (response.status === 401) redirect("/login"); if (response.status === 404) notFound();
  const payload = await readJson(response) as { readonly product: CatalogProductView; readonly variants?: readonly CatalogVariantView[]; readonly syncJobs?: readonly CatalogSyncJobView[]; readonly events?: readonly CatalogEventView[]; readonly medusaHealth?: MedusaHealthView | null };
  const item = findNavigationItemByHref("/catalog/products") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader item={{ ...item, status: "runtime-ready", label: payload.product.title, href: `/catalog/products/${encodeURIComponent(productId)}`, description: "Ürün metadata kaydını, varyantlarını, moderasyon akışını ve Medusa sync işlerini yönetin." }} principal={session.principal} /><CatalogProductDetailPanel initialEvents={payload.events ?? []} initialProduct={payload.product} initialSyncJobs={payload.syncJobs ?? []} initialVariants={payload.variants ?? []} medusaHealth={payload.medusaHealth} /></AdminShell>;
}
