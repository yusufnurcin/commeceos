import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { CatalogProductsPanel, type CatalogModuleView, type CatalogProductView, type CatalogSyncJobView, type MedusaHealthView } from "@/components/catalog-products-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function CatalogProductsPage() {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const [productResponse, jobResponse] = await Promise.all([gatewayFetchWithRefresh("/v1/catalog/products", {}, { allowCookieMutation: false }), gatewayFetchWithRefresh("/v1/catalog/medusa-sync-jobs", {}, { allowCookieMutation: false })]);
  if (productResponse.status === 401 || jobResponse.status === 401) redirect("/login");
  const productPayload = await readJson(productResponse) as { readonly products?: readonly CatalogProductView[]; readonly module?: CatalogModuleView | null; readonly medusaHealth?: MedusaHealthView | null };
  const jobPayload = await readJson(jobResponse) as { readonly syncJobs?: readonly CatalogSyncJobView[] };
  const item = findNavigationItemByHref("/catalog/products") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader actions={<Link href="/catalog/categories">Kategoriler</Link>} item={{ ...item, status: "runtime-ready", description: "Gerçek ürün kayıtlarını, moderasyon kararlarını ve kontrollü Medusa sync kuyruğunu yönetin." }} principal={session.principal} /><CatalogProductsPanel initialProducts={productPayload.products ?? []} initialSyncJobs={jobPayload.syncJobs ?? []} medusaHealth={productPayload.medusaHealth} module={productPayload.module} /></AdminShell>;
}
