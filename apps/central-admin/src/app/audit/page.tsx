import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, AuditMiniTimeline, DataToolbar, EmptyOperationalState, PageHeader, ServiceStatusCard } from "@/components/admin";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function AuditPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const response = await gatewayFetchWithRefresh("/v1/audit/runtime", {}, { allowCookieMutation: false });
  const payload = (await readJson(response)) as {
    readonly events?: readonly {
      readonly audit_id?: string;
      readonly action?: string;
      readonly result?: string;
      readonly occurred_at?: string;
      readonly tenant_id?: string;
      readonly workspace_id?: string;
    }[];
  };
  const item = findNavigationItemByHref("/security/audit") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          label: "Audit Center",
          href: "/audit",
          description: "Giriş, başarısız giriş, tenant oluşturma, oturum kapatma ve önemli yönetim olaylarını izleyin."
        }}
        principal={session.principal}
        actions={
          <Link className="primary-link" href="/security/audit">
            Güvenlik Audit Modülü
          </Link>
        }
      />
      <section className="dashboard-section">
        <DataToolbar title="Son Audit Olayları" description="Fake kayıt yok; yalnızca gerçek auth ve provisioning olayları listelenir." />
        {payload.events?.length ? (
          <AuditMiniTimeline events={payload.events} />
        ) : (
          <EmptyOperationalState title="Audit olayı bekleniyor" description="Gerçek auth veya provisioning olayı oluştuğunda bu liste dolacak." />
        )}
      </section>
      <section className="dashboard-section">
        <DataToolbar title="Audit akışı" description="Bu alan teknik payload yerine okunabilir olay durumunu gösterir." />
        <ServiceStatusCard
          label="Audit kayıtları"
          status={payload.events?.length ? "Kayıt var" : "Olay bekleniyor"}
          detail={payload.events?.length ? "Son olaylar yukarıda listelendi." : "Login ve tenant işlemleri başladıkça burada olaylar görünür."}
          tone={payload.events?.length ? "ready" : "waiting"}
        />
      </section>
    </AdminShell>
  );
}
