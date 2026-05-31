import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { CatalogCategoriesPanel, type CatalogCategoryView } from "@/components/catalog-categories-panel";
import type { CatalogModuleView } from "@/components/catalog-products-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function CatalogCategoriesPage() {
  const session = await getCurrentSession(); if (!session?.principal) redirect("/login");
  const response = await gatewayFetchWithRefresh("/v1/catalog/categories", {}, { allowCookieMutation: false }); if (response.status === 401) redirect("/login");
  const payload = await readJson(response) as { readonly categories?: readonly CatalogCategoryView[]; readonly module?: CatalogModuleView | null };
  const item = findNavigationItemByHref("/catalog/categories") ?? navigationManifest[0]!;
  return <AdminShell navigation={navigationManifest} principal={session.principal}><PageHeader actions={<Link href="/catalog/products">Ürünler</Link>} item={{ ...item, status: "runtime-ready", description: "Kategori ağacını, SEO metadata alanlarını ve Medusa kategori eşleşmelerini yönetin." }} principal={session.principal} /><CatalogCategoriesPanel initialCategories={payload.categories ?? []} module={payload.module} /></AdminShell>;
}
