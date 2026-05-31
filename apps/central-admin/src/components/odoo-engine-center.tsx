export interface OdooEngineStatusView {
  readonly health?: { readonly status?: string; readonly latencyMs?: number; readonly error?: string };
  readonly connection?: { readonly internalUrl?: string; readonly database?: string; readonly authentication?: string; readonly rawUiExposed?: boolean };
  readonly installedModules?: { readonly status?: string; readonly message?: string; readonly requestedAtBootstrap?: readonly string[] };
  readonly bridgeJobs?: readonly { readonly operation: string; readonly status: string; readonly count: number }[];
  readonly readiness?: { readonly ready?: readonly string[]; readonly partial?: readonly string[]; readonly missing?: readonly string[] };
}

const labels: Record<string, string> = {
  container: "Container",
  tcp_health: "TCP sağlık sinyali",
  database_target: "ERP veritabanı hedefi",
  raw_ui_isolation: "Ham Odoo UI izolasyonu",
  bridge_contract: "Gateway bridge sözleşmesi",
  integration_vault_provider: "Integration Vault provider kaydı",
  odoo_auth_adapter: "Odoo auth adaptörü",
  installed_module_verification: "Kurulu modül doğrulaması",
  accounting_mapping: "Muhasebe eşleştirmesi",
  invoice_sync: "Fatura senkronizasyonu",
  tax_rules: "Vergi kuralları",
  stock_sync: "Stok senkronizasyonu",
  purchase_sync: "Satın alma senkronizasyonu",
  conflict_resolver: "Çakışma çözümleyici",
  worker: "ERP worker",
  erp_preview_ui: "ERP önizleme arayüzü"
};

function List({ items }: { readonly items: readonly string[] | undefined }) {
  return <ul className="engine-check-list">{(items ?? []).map((item) => <li key={item}>{labels[item] ?? item}</li>)}</ul>;
}

export function OdooEngineCenter({ payload }: { readonly payload: OdooEngineStatusView }) {
  return (
    <div className="odoo-engine-center">
      <section className="engine-position-card">
        <header>
          <div>
            <h2>Odoo ERP Engine</h2>
            <p>Odoo ham yönetim paneli değildir. Commerce OS içinde muhasebe, stok, fatura ve satın alma için kontrollü ERP motoru olarak konumlanır.</p>
          </div>
          <mark data-state={payload.health?.status === "ok" ? "ok" : "waiting"}>{payload.health?.status === "ok" ? "Sağlık sinyali hazır" : "Kısıtlı mod"}</mark>
        </header>
        <dl className="catalog-metadata">
          <div><dt>İç URL</dt><dd>{payload.connection?.internalUrl ?? "Bekleniyor"}</dd></div>
          <div><dt>Veritabanı hedefi</dt><dd>{payload.connection?.database ?? "Bekleniyor"}</dd></div>
          <div><dt>Auth durumu</dt><dd>{payload.connection?.authentication === "adapter_not_configured" ? "Adaptör henüz bağlı değil" : payload.connection?.authentication ?? "Bekleniyor"}</dd></div>
          <div><dt>Ham UI</dt><dd>{payload.connection?.rawUiExposed ? "Açık" : "Platform kullanıcılarına kapalı"}</dd></div>
        </dl>
      </section>

      <div className="engine-readiness-grid">
        <section><h2>Hazır</h2><List items={payload.readiness?.ready} /></section>
        <section><h2>Kısmen hazır</h2><List items={payload.readiness?.partial} /></section>
        <section><h2>Eksik</h2><List items={payload.readiness?.missing} /></section>
      </div>

      <section className="dashboard-section">
        <h2>Modül görünürlüğü</h2>
        <p>{payload.installedModules?.message}</p>
        <div className="engine-tag-list">{payload.installedModules?.requestedAtBootstrap?.map((module) => <span key={module}>{module}</span>)}</div>
      </section>

      <section className="dashboard-section">
        <h2>Bridge işleri</h2>
        {payload.bridgeJobs?.length ? <div className="engine-tag-list">{payload.bridgeJobs.map((job) => <span key={`${job.operation}-${job.status}`}>{job.operation} · {job.status} · {job.count}</span>)}</div> : <p className="empty-state">Henüz ERP bridge işi yok. Worker ve mapping akışı sonraki ERP Center fazında bağlanacak.</p>}
      </section>
    </div>
  );
}
