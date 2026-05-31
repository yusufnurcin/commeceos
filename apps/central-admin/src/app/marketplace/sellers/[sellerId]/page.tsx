import { notFound, redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { SellerDetailPanel } from "@/components/seller-detail-panel";
import type {
  MarketplaceApplicationView,
  MarketplaceKycDocumentView,
  MarketplaceSellerView
} from "@/components/seller-onboarding-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

interface MarketplaceSellerEventView {
  readonly id: string;
  readonly event_type: string;
  readonly created_at: string;
}

export default async function MarketplaceSellerDetailPage({
  params
}: {
  readonly params: Promise<{ readonly sellerId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }
  const { sellerId } = await params;
  const response = await gatewayFetchWithRefresh(`/v1/marketplace/sellers/${encodeURIComponent(sellerId)}`, {}, { allowCookieMutation: false });
  if (response.status === 401) {
    redirect("/login");
  }
  if (response.status === 404) {
    notFound();
  }
  const payload = (await readJson(response)) as {
    readonly seller: MarketplaceSellerView;
    readonly applications?: readonly MarketplaceApplicationView[];
    readonly kycDocuments?: readonly MarketplaceKycDocumentView[];
    readonly events?: readonly MarketplaceSellerEventView[];
  };
  const item = findNavigationItemByHref("/marketplace/sellers") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          status: "runtime-ready",
          label: payload.seller.displayName,
          href: `/marketplace/sellers/${encodeURIComponent(sellerId)}`,
          description: "Satıcı profilini, KYC belgelerini, onboarding geçmişini ve operasyon durumunu yönetin."
        }}
        principal={session.principal}
      />
      <SellerDetailPanel
        initialApplications={payload.applications ?? []}
        initialDocuments={payload.kycDocuments ?? []}
        initialEvents={payload.events ?? []}
        initialSeller={payload.seller}
      />
    </AdminShell>
  );
}
