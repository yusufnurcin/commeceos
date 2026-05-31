"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

export interface CatalogModuleView {
  readonly key: string;
  readonly isEnabled: boolean;
  readonly status: string;
}

export interface MedusaHealthView {
  readonly status: string;
  readonly latencyMs?: number;
  readonly message?: string;
}

export interface CatalogProductView {
  readonly productId: string;
  readonly tenantId?: string | null;
  readonly sellerId?: string | null;
  readonly title: string;
  readonly subtitle?: string | null;
  readonly description?: string | null;
  readonly productType: string;
  readonly status: string;
  readonly moderationStatus: string;
  readonly syncStatus: string;
  readonly country: string;
  readonly currency: string;
  readonly basePriceAmount?: number | null;
  readonly sku?: string | null;
  readonly slug?: string | null;
  readonly brand?: string | null;
  readonly categoryKey?: string | null;
  readonly attributes?: unknown;
  readonly media?: unknown;
  readonly seo?: unknown;
  readonly variantCount: number;
}

export interface CatalogVariantView {
  readonly variantId: string;
  readonly productId: string;
  readonly title: string;
  readonly sku?: string | null;
  readonly priceAmount?: number | null;
  readonly currency?: string | null;
  readonly stockQuantity?: number | null;
  readonly attributes?: unknown;
}

export interface CatalogSyncJobView {
  readonly jobId: string;
  readonly productId?: string | null;
  readonly jobType: string;
  readonly status: string;
  readonly attemptCount: number;
  readonly lastError?: string | null;
  readonly createdAt: string;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

export function catalogReadableError(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "catalog_module_required":
      return "Ürün işlemleri için önce Modül Merkezi'nden catalog modülünü aktif edin.";
    case "catalog_product_invalid":
      return "Ürün alanlarını kontrol edin. Başlık, ürün tipi, ülke ve para birimi zorunlu.";
    case "catalog_product_rejection_reason_required":
      return "Ürünü reddetmek için inceleme notu girin.";
    case "catalog_product_not_approved":
      return "Medusa senkronizasyonu için önce ürünü onaylayın.";
    case "seller_not_approved":
      return "Seçilen satıcı onaylı değil. Ürün yalnızca onaylı bir satıcıya bağlanabilir.";
    case "medusa_unavailable":
      return "Medusa servisine ulaşılamıyor. Ürün kaydı korundu; senkronizasyon kuyruğa alınmadı.";
    case "runtime_store_unavailable":
      return "Katalog kayıt servisine şu anda ulaşılamıyor.";
    default:
      return fallback;
  }
}

function label(value: string) {
  const values: Record<string, string> = {
    draft: "Taslak",
    active: "Aktif",
    inactive: "Pasif",
    archived: "Arşivlendi",
    pending_review: "İnceleme bekliyor",
    approved: "Onaylı",
    rejected: "Reddedildi",
    needs_changes: "Değişiklik gerekli",
    not_synced: "Senkronize edilmedi",
    queued: "Kuyrukta",
    syncing: "Senkronize ediliyor",
    synced: "Senkronize",
    failed: "Başarısız"
  };
  return values[value] ?? value;
}

export function CatalogProductsPanel({
  initialProducts,
  initialSyncJobs,
  module,
  medusaHealth
}: {
  readonly initialProducts: readonly CatalogProductView[];
  readonly initialSyncJobs: readonly CatalogSyncJobView[];
  readonly module?: CatalogModuleView | null | undefined;
  readonly medusaHealth?: MedusaHealthView | null | undefined;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [syncJobs, setSyncJobs] = useState(initialSyncJobs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [moderationFilter, setModerationFilter] = useState("all");
  const [rejectProductId, setRejectProductId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moduleEnabled = module?.isEnabled === true;
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return products.filter((product) => {
      const searchMatch = !normalized || [product.title, product.productId, product.sellerId, product.sku, product.brand].join(" ").toLocaleLowerCase("tr-TR").includes(normalized);
      return searchMatch && (statusFilter === "all" || product.status === statusFilter) && (moderationFilter === "all" || product.moderationStatus === moderationFilter);
    });
  }, [moderationFilter, products, query, statusFilter]);

  function start() {
    setBusy(true);
    setMessage(null);
    setError(null);
  }

  async function refresh() {
    const [productsResponse, jobsResponse] = await Promise.all([
      fetch("/api/catalog/products", { cache: "no-store" }),
      fetch("/api/catalog/medusa-sync-jobs", { cache: "no-store" })
    ]);
    const productPayload = await readJson(productsResponse);
    const jobPayload = await readJson(jobsResponse);
    if (!productsResponse.ok || !jobsResponse.ok) {
      setError("Katalog kayıtları yenilenemedi.");
      return;
    }
    setProducts((productPayload.products as CatalogProductView[] | undefined) ?? []);
    setSyncJobs((jobPayload.syncJobs as CatalogSyncJobView[] | undefined) ?? []);
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    start();
    const response = await fetch("/api/catalog/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: String(data.get("title") ?? ""),
        productType: String(data.get("productType") ?? ""),
        country: String(data.get("country") ?? ""),
        currency: String(data.get("currency") ?? ""),
        basePriceAmount: String(data.get("basePriceAmount") ?? ""),
        sku: String(data.get("sku") ?? ""),
        brand: String(data.get("brand") ?? ""),
        sellerId: String(data.get("sellerId") ?? ""),
        slug: String(data.get("slug") ?? "")
      })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(catalogReadableError(payload, "Ürün oluşturulamadı."));
      return;
    }
    form.reset();
    setMessage("Ürün taslak olarak kaydedildi.");
    await refresh();
  }

  async function action(productId: string, operation: "submit" | "approve" | "archive" | "queue-medusa-sync") {
    start();
    const response = await fetch(`/api/catalog/products/${encodeURIComponent(productId)}/${operation}`, { method: "POST" });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(catalogReadableError(payload, "Ürün işlemi uygulanamadı."));
      return;
    }
    setMessage(operation === "queue-medusa-sync" ? "Medusa katalog sync işi kuyruğa alındı." : "Ürün durumu güncellendi.");
    await refresh();
  }

  async function rejectProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectProductId) return;
    start();
    const response = await fetch(`/api/catalog/products/${encodeURIComponent(rejectProductId)}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: rejectReason })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(catalogReadableError(payload, "Ürün reddedilemedi."));
      return;
    }
    setRejectProductId("");
    setRejectReason("");
    setMessage("Ürün inceleme notuyla reddedildi.");
    await refresh();
  }

  return (
    <div className="catalog-panel">
      {!moduleEnabled ? (
        <section className="module-disabled-warning">
          <div><strong>Catalog modülü pasif</strong><p>Ürün kayıtlarını görebilirsiniz. Yeni kayıt ve moderasyon işlemleri için modülü aktif edin.</p></div>
          <Link href="/modules?highlight=catalog">Catalog modülünü aç</Link>
        </section>
      ) : null}
      <section className="catalog-health-strip">
        <div><strong>Medusa katalog köprüsü</strong><span>{medusaHealth?.status === "ok" ? "Medusa hazır, sync job kuyruğa alınabilir." : "Medusa erişilemiyor; ürün kayıtları korunur, sync kuyruğu kontrollü olarak durur."}</span></div>
        <mark data-state={medusaHealth?.status ?? "unknown"}>{medusaHealth?.status === "ok" ? "Hazır" : "Kısıtlı mod"}</mark>
      </section>
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <section className="catalog-toolbar">
        <label>Ürün ara<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, SKU, marka veya ürün kodu" /></label>
        <label>Ürün durumu<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tümü</option><option value="draft">Taslak</option><option value="active">Aktif</option><option value="inactive">Pasif</option><option value="archived">Arşiv</option></select></label>
        <label>Moderasyon<select value={moderationFilter} onChange={(event) => setModerationFilter(event.target.value)}><option value="all">Tümü</option><option value="pending_review">İnceleme bekleyen</option><option value="approved">Onaylı</option><option value="rejected">Reddedildi</option></select></label>
      </section>
      <div className="catalog-layout">
        <main className="catalog-main">
          <section className="catalog-section">
            <header><div><h2>Ürünler</h2><p>{filteredProducts.length} ürün gösteriliyor.</p></div><Link href="/catalog/categories">Kategoriler</Link></header>
            <div className="catalog-card-list">
              {filteredProducts.map((product) => (
                <article className="catalog-record-card" key={product.productId}>
                  <header><div><h3>{product.title}</h3><p>{product.productId}</p></div><mark>{label(product.moderationStatus)}</mark></header>
                  <dl className="catalog-metadata">
                    <div><dt>Durum</dt><dd>{label(product.status)}</dd></div><div><dt>Sync</dt><dd>{label(product.syncStatus)}</dd></div>
                    <div><dt>Fiyat</dt><dd>{product.basePriceAmount ?? "-"} {product.currency}</dd></div><div><dt>Varyant</dt><dd>{product.variantCount}</dd></div>
                    <div><dt>Satıcı</dt><dd>{product.sellerId ?? "Platform kataloğu"}</dd></div><div><dt>Tenant</dt><dd>{product.tenantId ?? "Global"}</dd></div>
                  </dl>
                  <div className="catalog-action-row">
                    <Link href={`/catalog/products/${encodeURIComponent(product.productId)}`}>Detayı aç</Link>
                    <button disabled={busy || !moduleEnabled} onClick={() => action(product.productId, "submit")}>İncelemeye gönder</button>
                    <button disabled={busy || !moduleEnabled} onClick={() => action(product.productId, "approve")}>Onayla</button>
                    <button disabled={busy || !moduleEnabled} onClick={() => setRejectProductId(product.productId)}>Reddet</button>
                    <button disabled={busy || !moduleEnabled || medusaHealth?.status !== "ok"} onClick={() => action(product.productId, "queue-medusa-sync")}>Medusa kuyruğuna al</button>
                  </div>
                </article>
              ))}
              {!filteredProducts.length ? <p className="empty-state">Henüz ürün yok. İlk gerçek ürünü sağdaki formdan oluşturun.</p> : null}
            </div>
          </section>
          <section className="catalog-section"><header><div><h2>Medusa sync işleri</h2><p>Doğrudan ürün basılmaz; onaylı ürün snapshot&apos;ları iş kuyruğunda tutulur.</p></div></header>
            <div className="catalog-card-list">{syncJobs.slice(0, 8).map((job) => <article className="catalog-record-card" key={job.jobId}><strong>{job.jobId}</strong><span>{job.productId}</span><small>{label(job.status)} · Deneme: {job.attemptCount}</small></article>)}{!syncJobs.length ? <p className="empty-state">Henüz Medusa sync işi yok.</p> : null}</div>
          </section>
        </main>
        <aside className="catalog-detail">
          <section><h2>Yeni ürün</h2><p>Gerçek katalog kaydı oluşturur. Storefront yayını bu fazın kapsamı değildir.</p>
            <form className="catalog-form" onSubmit={createProduct}>
              <label>Ürün adı<input name="title" required /></label>
              <label>Ürün tipi<select name="productType" defaultValue="physical"><option value="physical">Fiziksel</option><option value="digital">Dijital</option><option value="service">Hizmet</option><option value="subscription">Abonelik</option><option value="bundle">Paket</option><option value="auction">Açık artırma</option><option value="rental">Kiralama</option></select></label>
              <div className="catalog-form-grid"><label>Ülke<input name="country" defaultValue="TR" maxLength={2} required /></label><label>Para birimi<input name="currency" defaultValue="TRY" maxLength={3} required /></label></div>
              <label>Taban fiyat<input name="basePriceAmount" inputMode="decimal" placeholder="0.00" /></label>
              <label>SKU<input name="sku" /></label><label>Marka<input name="brand" /></label><label>Slug<input name="slug" placeholder="urun-slug" /></label>
              <label>Satıcı kodu <small>Boş bırakılırsa platform kataloğu</small><input name="sellerId" /></label>
              <button disabled={busy || !moduleEnabled}>Ürünü kaydet</button>
            </form>
          </section>
          {rejectProductId ? <section><h2>Ürünü reddet</h2><form className="catalog-form" onSubmit={rejectProduct}><label>İnceleme notu<textarea required value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /></label><div className="catalog-action-row"><button disabled={busy}>Reddet</button><button type="button" onClick={() => setRejectProductId("")}>Vazgeç</button></div></form></section> : null}
        </aside>
      </div>
    </div>
  );
}
