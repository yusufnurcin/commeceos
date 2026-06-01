import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell, DataToolbar, QuickActionGrid, ServiceStatusCard } from "@/components/admin";
import { navigationManifest } from "@/config/navigation";
import { quickActions } from "@/config/management";
import { getDashboardRuntime } from "@/lib/runtime-data";

function service(entries: readonly { readonly service?: string; readonly status?: string; readonly latencyMs?: number }[], key: string, label: string, detail: string) {
  const entry = entries.find((candidate) => candidate.service === key);
  return {
    label,
    status: entry?.status === "ok" ? "Hazır" : "Kısıtlı mod",
    detail: entry?.status === "ok" ? `${detail}${typeof entry.latencyMs === "number" ? ` · ${entry.latencyMs} ms` : ""}` : `${detail} Şu anda yanıt alınamıyor.`,
    tone: entry?.status === "ok" ? "ready" : "attention"
  } as const;
}

export default async function CentralAdminDashboardPage() {
  const payload = await getDashboardRuntime();
  if (payload.status === "auth_required" || !payload.me?.principal) redirect("/login");
  const counts = payload.demo?.counts;
  const entries = payload.healthMatrix?.entries ?? [];
  const modules = new Map((payload.demo?.modules ?? []).map((module) => [module.key, module]));
  const coreCards = [
    { title: "Tenant Registry", description: "Tenant provisioning, workspace ve izolasyon kayıtları.", href: "/tenants", module: "tenants", real: counts?.real_tenants ?? 0, demo: counts?.demo_tenants ?? 0 },
    { title: "Module Registry", description: "Platform modüllerinin gerçek açma, kapama ve olay geçmişi.", href: "/modules", module: "modules", real: counts?.module_registry_total ?? 0, demo: 0 },
    { title: "Theme Registry", description: "Sektör temaları ve tenant tema atamaları.", href: "/design/themes", module: "themes", real: counts?.theme_registry_total ?? 0, demo: counts?.demo_tenants ?? 0 },
    { title: "Plugin Registry", description: "Plugin katalog kayıtları, aktivasyon ve ayarlar.", href: "/modules/plugins", module: "plugins", real: counts?.plugin_registry_total ?? 0, demo: 0 },
    { title: "Integration Vault", description: "Sağlayıcı kataloğu, şifreli credential ve dayanıklılık politikaları.", href: "/settings/integrations", module: "integrations", real: counts?.integration_provider_total ?? 0, demo: 0 },
    { title: "Seller / KYC", description: "Satıcı başvurusu, onay ve belge metadata lifecycle.", href: "/marketplace/sellers", module: "marketplace", real: counts?.real_sellers ?? 0, demo: counts?.demo_sellers ?? 0 },
    { title: "Catalog / Product", description: "Ürün, kategori, varyant ve moderasyon çekirdeği.", href: "/catalog/products", module: "catalog", real: counts?.real_products ?? 0, demo: counts?.demo_products ?? 0 },
    { title: "Order Core", description: "Sipariş, kalem, iade, refund ve iç operasyon durumları.", href: "/orders", module: "orders", real: counts?.real_orders ?? 0, demo: counts?.demo_orders ?? 0 }
  ] as const;

  return (
    <AdminShell navigation={navigationManifest} principal={payload.me.principal}>
      <header className="product-dashboard-hero">
        <div>
          <span>Commerce OS Core</span>
          <h1>Central Admin</h1>
          <p>Çalışan çekirdekleri, gerçek kayıtları ve açıkça etiketlenmiş demo verisini tek merkezden yönetin.</p>
        </div>
        <div className="catalog-action-row">
          <Link className="primary-link" href="/tenants/new">Yeni tenant oluştur</Link>
          <Link className="secondary-link" href="/settings/demo">Demo Merkezi</Link>
        </div>
      </header>

      <section className="dashboard-section">
        <DataToolbar title="Hızlı işlemler" description="Doğrudan gerçek yönetim akışlarına gidin." />
        <QuickActionGrid actions={[...quickActions, { label: "Demo Merkezi", href: "/settings/demo", description: "Açıkça etiketlenmiş demo lifecycle kayıtlarını yönet" }]} />
      </section>

      <section className="dashboard-section">
        <DataToolbar title="Çalışan çekirdekler" description="Sayaçlar PostgreSQL kayıtlarından gelir. Demo kayıtlar üretim verisinden ayrı gösterilir." />
        <div className="product-core-grid">
          {coreCards.map((card) => {
            const registryModule = modules.get(card.module);
            return (
              <article className="product-core-card" key={card.title}>
                <header><h2>{card.title}</h2><mark data-state={registryModule?.isEnabled === false ? "waiting" : "ok"}>{registryModule?.isEnabled === false ? "Pasif" : "Hazır"}</mark></header>
                <p>{card.description}</p>
                <dl><div><dt>Gerçek kayıt</dt><dd>{card.real}</dd></div><div><dt>Demo kayıt</dt><dd>{card.demo}</dd></div></dl>
                <Link href={card.href}>Yönetim ekranına git</Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <DataToolbar title="Engine konumu" description="Commerce OS Core bağımsızdır. Harici motorların seviyesi açıkça ayrılır." />
        <div className="service-status-grid">
          <ServiceStatusCard {...service(entries, "gateway-api", "Gateway", "Ana API omurgası yanıt veriyor.")} />
          <ServiceStatusCard {...service(entries, "medusa", "Medusa Bridge Provider", "Opsiyonel commerce provider / bridge.")} />
          <ServiceStatusCard {...service(entries, "odoo", "ERP Provider / Odoo Engine", "Opsiyonel ERP provider sağlık sinyali. Adaptör ve worker durumu ERP merkezinde ayrılır.")} />
          <ServiceStatusCard label="Demo Mode" status={payload.demo?.demoModeEnabled ? "Açık" : "Kapalı"} detail="Demo verisi üretim kayıtlarından açıkça ayrılır." tone={payload.demo?.demoModeEnabled ? "ready" : "waiting"} />
        </div>
      </section>

      <section className="dashboard-section">
        <DataToolbar title="Son gerçek olaylar" description="Ham JSON yerine son audit sinyalleri." />
        <div className="audit-readable-list">
          {payload.demo?.recentAudit?.length ? payload.demo.recentAudit.map((event) => <article key={`${event.action}-${String(event.occurred_at)}`}><strong>{event.action}</strong><span>{event.result}</span><small>{String(event.occurred_at)}</small></article>) : <p className="empty-state">Henüz audit olayı yok.</p>}
        </div>
      </section>

      <section className="operational-empty">
        <div><strong>Boş panel, çalışmayan panel değildir.</strong><p>Gerçek kayıt yoksa yeni kayıt oluşturun veya Demo Merkezi üzerinden ayrı etiketli demo lifecycle akışını çalıştırın.</p></div>
        <Link href="/settings/demo">Demo veriyi yönet</Link>
      </section>
    </AdminShell>
  );
}
