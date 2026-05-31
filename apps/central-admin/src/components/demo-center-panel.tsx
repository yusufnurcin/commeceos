"use client";

import { useState } from "react";

export interface DemoCountsView {
  readonly module_registry_total: number;
  readonly enabled_modules: number;
  readonly theme_registry_total: number;
  readonly plugin_registry_total: number;
  readonly integration_provider_total: number;
  readonly demo_tenants: number;
  readonly demo_sellers: number;
  readonly demo_seller_applications: number;
  readonly demo_kyc_documents: number;
  readonly demo_products: number;
  readonly demo_categories: number;
  readonly demo_variants: number;
  readonly demo_orders: number;
  readonly demo_returns: number;
  readonly demo_refunds: number;
  readonly demo_sync_jobs: number;
  readonly real_tenants: number;
  readonly real_sellers: number;
  readonly real_products: number;
  readonly real_orders: number;
}

export interface DemoStatusView {
  readonly status: string;
  readonly demoModeEnabled: boolean;
  readonly counts: DemoCountsView;
  readonly modules?: readonly { readonly key: string; readonly isEnabled: boolean; readonly status: string }[];
  readonly recentAudit?: readonly { readonly action: string; readonly result: string; readonly occurred_at: string }[];
  readonly latestRun?: {
    readonly run_id: string;
    readonly action: string;
    readonly status: string;
    readonly finished_at?: string | null;
  } | null;
}

const metrics: readonly [keyof DemoCountsView, string][] = [
  ["demo_tenants", "Tenant"],
  ["demo_sellers", "Satıcı"],
  ["demo_seller_applications", "Satıcı başvurusu"],
  ["demo_kyc_documents", "KYC belgesi"],
  ["demo_categories", "Kategori"],
  ["demo_products", "Ürün"],
  ["demo_variants", "Varyant"],
  ["demo_orders", "Sipariş"],
  ["demo_returns", "İade"],
  ["demo_refunds", "Refund"],
  ["demo_sync_jobs", "Opsiyonel sync işi"]
];

async function readDemo(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<DemoStatusView & { readonly message?: string }>;
}

export function DemoCenterPanel({ initialStatus }: { readonly initialStatus: DemoStatusView }) {
  const [payload, setPayload] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "seed" | "cleanup") {
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/demo/${action}`, { method: "POST" });
    const next = await readDemo(response);
    setBusy(false);
    if (!response.ok) {
      setError(next.status === "demo_mode_disabled" ? "Demo modu kapalı. Ortam ayarından DEMO_MODE_ENABLED=true yapın." : next.message ?? "Demo işlemi uygulanamadı.");
      return;
    }
    setPayload(next);
    setMessage(action === "seed" ? "Demo lifecycle kayıtları oluşturuldu. İkinci seed çağrısı duplicate üretmez." : "Demo kayıtları güvenli sınırlar içinde temizlendi.");
  }

  return (
    <div className="demo-center">
      <section className="engine-position-card">
        <header>
          <div>
            <h2>Demo modu</h2>
            <p>Demo kayıtları üretim verisinden ayrıdır. Her kayıt açık demo etiketi ve cleanup sınırı taşır.</p>
          </div>
          <mark data-state={payload.demoModeEnabled ? "ok" : "waiting"}>{payload.demoModeEnabled ? "Açık" : "Kapalı"}</mark>
        </header>
        <div className="catalog-action-row">
          <button disabled={busy || !payload.demoModeEnabled} onClick={() => void run("seed")}>Demo veriyi oluştur</button>
          <button disabled={busy || !payload.demoModeEnabled} onClick={() => void run("cleanup")}>Demo veriyi temizle</button>
        </div>
        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <section className="dashboard-section">
        <header className="demo-section-header">
          <div>
            <h2>Demo kayıt sayaçları</h2>
            <p>Tenant, satıcı/KYC, katalog ve sipariş çekirdekleri gerçek DB sözleşmelerini kullanır.</p>
          </div>
          <small>Son işlem: {payload.latestRun ? `${payload.latestRun.action} · ${payload.latestRun.status}` : "Henüz çalıştırılmadı"}</small>
        </header>
        <div className="product-core-grid">
          {metrics.map(([key, label]) => <article className="product-core-card" key={key}><span>{label}</span><strong>{payload.counts[key]}</strong><small>Demo kayıt</small></article>)}
        </div>
      </section>

      <section className="operational-empty">
        <div>
          <strong>Etkilenen gerçek çekirdekler</strong>
          <p>Tenant Registry, Theme Assignment, Seller/KYC, Catalog/Product ve Order Core. Medusa sync yalnız provider hazırsa kuyruğa alınır; doğrudan engine yazımı yapılmaz.</p>
        </div>
      </section>
    </div>
  );
}
