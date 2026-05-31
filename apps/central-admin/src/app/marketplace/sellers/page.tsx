import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import {
  SellerOnboardingPanel,
  type MarketplaceApplicationView,
  type MarketplaceModuleView,
  type MarketplaceSellerView
} from "@/components/seller-onboarding-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function MarketplaceSellersPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const [sellerResponse, applicationResponse] = await Promise.all([
    gatewayFetchWithRefresh("/v1/marketplace/sellers", {}, { allowCookieMutation: false }),
    gatewayFetchWithRefresh("/v1/marketplace/seller-applications", {}, { allowCookieMutation: false })
  ]);
  if (sellerResponse.status === 401 || applicationResponse.status === 401) {
    redirect("/login");
  }
  const sellerPayload = (await readJson(sellerResponse)) as {
    readonly sellers?: readonly MarketplaceSellerView[];
    readonly module?: MarketplaceModuleView | null;
  };
  const applicationPayload = (await readJson(applicationResponse)) as {
    readonly applications?: readonly MarketplaceApplicationView[];
    readonly module?: MarketplaceModuleView | null;
  };
  const item = findNavigationItemByHref("/marketplace/sellers") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        actions={<Link href="/marketplace/kyc">KYC Merkezi</Link>}
        item={{
          ...item,
          status: "runtime-ready",
          description: "Gerçek satıcı başvurularını, KYC metadata kayıtlarını ve onay akışını Marketplace Registry üzerinden yönetin."
        }}
        principal={session.principal}
      />
      <SellerOnboardingPanel
        initialApplications={applicationPayload.applications ?? []}
        initialSellers={sellerPayload.sellers ?? []}
        module={sellerPayload.module ?? applicationPayload.module ?? null}
      />
    </AdminShell>
  );
}
