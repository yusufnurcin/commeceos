import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminShell,
  DataToolbar,
  EmptyOperationalState,
  ManagementAreaGrid,
  PageHeader,
  QuickActionGrid,
  ServiceStatusCard
} from "@/components/admin";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { managementAreas, quickActions } from "@/config/management";
import { getDashboardRuntime } from "@/lib/runtime-data";

function serviceTone(status?: string) {
  return status === "ok" ? "ready" : "waiting";
}

function readableService(
  entries: readonly { readonly service?: string; readonly status?: string; readonly latencyMs?: number }[],
  service: string,
  label: string
) {
  const entry = entries.find((item) => item.service === service);
  return {
    label,
    status: entry?.status === "ok" ? "Hazır" : "Bekleniyor",
    detail: entry ? `${service} yanıt veriyor${typeof entry.latencyMs === "number" ? ` · ${entry.latencyMs} ms` : ""}` : "Servis sinyali bekleniyor.",
    tone: serviceTone(entry?.status)
  } as const;
}

export default async function CentralAdminDashboardPage() {
  const payload = await getDashboardRuntime();
  if (payload.status === "auth_required" || !payload.me?.principal) {
    redirect("/login");
  }

  const principal = payload.me.principal;
  const dashboardItem = findNavigationItemByHref("/platform/health") ?? navigationManifest[0]!;
  const tenants = payload.tenants?.tenants ?? [];
  const entries = payload.healthMatrix?.entries ?? [];
  const queueReady = Boolean(payload.queue);
  const auditReady = Boolean(payload.audit);

  return (
    <AdminShell navigation={navigationManifest} principal={principal}>
      <PageHeader
        item={{
          ...dashboardItem,
          label: "Ana Yönetim Dashboard",
          description:
            "Commerce OS Central Admin artık günlük yönetim işleri için ana kontrol paneli; tenant, satıcı, ürün, sipariş, finans, ERP ve modül yönetimi tek yerden başlar."
        }}
        principal={principal}
        actions={
          <Link className="primary-link" href="/tenants/new">
            Yeni Tenant Oluştur
          </Link>
        }
      />

      <section className="dashboard-section">
        <DataToolbar title="Hızlı İşlemler" description="En sık yapılan yönetim işlerine doğrudan gidin." />
        <QuickActionGrid actions={quickActions} />
      </section>

      <section className="dashboard-section">
        <DataToolbar title="Yönetim Alanları" description="Central Admin'in ana iş akışları. Alt işlemler ilgili sayfaların içinde kart olarak açılır." />
        <ManagementAreaGrid areas={managementAreas} />
      </section>

      <section className="dashboard-section compact-status-section">
        <DataToolbar title="Gerçek Durum" description="Sadece karar vermeye yetecek servis özeti; ham JSON gösterilmez." />
        <div className="service-status-grid">
          <ServiceStatusCard {...readableService(entries, "gateway-api", "Gateway")} />
          <ServiceStatusCard {...readableService(entries, "medusa", "Medusa")} />
          <ServiceStatusCard {...readableService(entries, "odoo", "Odoo")} />
          <ServiceStatusCard label="Queue" status={queueReady ? "Hazır" : "Bekleniyor"} detail="Kuyruk durumu operasyon modülleri açıldığında kullanılır." tone={queueReady ? "ready" : "waiting"} />
          <ServiceStatusCard label="Audit" status={auditReady ? "Hazır" : "Bekleniyor"} detail="Giriş, tenant ve oturum olayları kayda alınır." tone={auditReady ? "ready" : "waiting"} />
        </div>
      </section>

      <section className="dashboard-section">
        <DataToolbar title="Başlangıç Durumları" description="Veri yoksa kullanıcıyı yönlendiren gerçek operasyon mesajları." />
        <div className="dashboard-grid-three">
          <EmptyOperationalState
            title={tenants.length ? `${tenants.length} tenant kayıtlı` : "Henüz tenant yok. İlk tenant'ı oluştur."}
            description={tenants.length ? "Tenant yönetim ekranından domain, kullanıcı ve modül adımlarını kontrol edin." : "Yeni Tenant Oluştur aksiyonuyla gerçek provisioning akışını başlatın."}
            actionLabel="Tenant Yönetimi"
            href="/tenants"
          />
          <EmptyOperationalState title="Henüz satıcı başvurusu yok. Başvuru formunu aktif et." description="Satıcı kabul kurallarını ve KYC beklentilerini hazırlayın." actionLabel="Satıcı Yönetimi" href="/marketplace/sellers" />
          <EmptyOperationalState title="Henüz ürün yok. Medusa catalog bridge hazır." description="Ürün import ayarını hazırlayın; catalog bridge aktif olduğunda kayıtlar burada görünür." actionLabel="Ürünleri Yönet" href="/catalog/products" />
          <EmptyOperationalState title="Henüz sipariş akışı başlamadı." description="Checkout ve order bridge hazırlandığında sipariş operasyonları dolacak." actionLabel="Siparişleri Gör" href="/orders" />
          <EmptyOperationalState title="Henüz ödeme akışı yok. Ödeme sağlayıcılarını yapılandır." description="Cüzdan, payout ve bloke bakiye akışları sağlayıcı bağlantısından sonra açılır." actionLabel="Finans Ayarları" href="/finance/wallets" />
          <EmptyOperationalState title="Muhasebe mapping bekliyor." description="Odoo muhasebe bağlantısıyla vergi, fatura ve rapor alanları açılır." actionLabel="Muhasebe ve Vergi" href="/accounting/tax" />
        </div>
      </section>
    </AdminShell>
  );
}
