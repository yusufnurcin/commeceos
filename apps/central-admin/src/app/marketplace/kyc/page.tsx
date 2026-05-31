import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { SellerKycPanel } from "@/components/seller-kyc-panel";
import type { MarketplaceKycDocumentView } from "@/components/seller-onboarding-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function MarketplaceKycPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const response = await gatewayFetchWithRefresh("/v1/marketplace/kyc-documents", {}, { allowCookieMutation: false });
  if (response.status === 401) {
    redirect("/login");
  }
  const payload = (await readJson(response)) as { readonly kycDocuments?: readonly MarketplaceKycDocumentView[] };
  const item = findNavigationItemByHref("/marketplace/kyc") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        actions={<Link href="/marketplace/sellers">Satıcı Başvuruları</Link>}
        item={{
          ...item,
          status: "runtime-ready",
          description: "Satıcı KYC belge metadata kayıtlarını inceleyin; onay ve ret kararlarını gerçek audit akışıyla yönetin."
        }}
        principal={session.principal}
      />
      <SellerKycPanel initialDocuments={payload.kycDocuments ?? []} />
    </AdminShell>
  );
}
