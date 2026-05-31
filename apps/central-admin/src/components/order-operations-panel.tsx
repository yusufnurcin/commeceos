"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

export interface CommerceOrderModuleView { readonly key: string; readonly isEnabled: boolean; readonly status: string; }
export interface OrderMedusaHealthView { readonly status: string; readonly latencyMs?: number; readonly message?: string; }
export interface CommerceOrderView {
  readonly orderId: string; readonly tenantId?: string | null; readonly sellerId?: string | null; readonly customerId?: string | null;
  readonly source: string; readonly status: string; readonly paymentStatus: string; readonly fulfillmentStatus: string; readonly riskStatus: string;
  readonly currency: string; readonly subtotalAmount: number; readonly taxAmount: number; readonly shippingAmount: number; readonly discountAmount: number;
  readonly totalAmount: number; readonly customerEmail?: string | null; readonly customerPhone?: string | null; readonly billingAddress?: unknown;
  readonly shippingAddress?: unknown; readonly metadata?: unknown; readonly itemCount: number;
}
export interface CommerceOrderItemView {
  readonly itemId: string; readonly orderId: string; readonly productId?: string | null; readonly variantId?: string | null;
  readonly sellerId?: string | null; readonly title: string; readonly sku?: string | null; readonly quantity: number;
  readonly unitPriceAmount: number; readonly taxAmount: number; readonly discountAmount: number; readonly totalAmount: number;
}
export interface CommerceOrderReturnView { readonly returnId: string; readonly orderId: string; readonly status: string; readonly reason?: string | null; readonly createdAt: string; }
export interface CommerceOrderRefundView { readonly refundId: string; readonly orderId: string; readonly returnId?: string | null; readonly status: string; readonly amount: number; readonly currency: string; readonly reason?: string | null; readonly createdAt: string; }
export interface CommerceOrderSyncJobView { readonly jobId: string; readonly orderId?: string | null; readonly jobType: string; readonly status: string; readonly attemptCount: number; readonly lastError?: string | null; readonly createdAt: string; }
export interface CommerceOrderEventView { readonly id: string; readonly event_type: string; readonly created_at: string; }

export async function readOrderJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

export function orderReadableError(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "orders_module_required": return "Sipariş işlemleri için önce Modül Merkezi'nden orders modülünü aktif edin.";
    case "order_invalid": return "Sipariş alanlarını kontrol edin. Kaynak ve para birimi zorunlu; tutarlar negatif olamaz.";
    case "order_item_invalid": return "Kalem alanlarını kontrol edin. Başlık, adet ve birim fiyat zorunlu.";
    case "seller_not_approved": return "Seçilen satıcı onaylı değil. Sipariş yalnızca onaylı bir satıcıya bağlanabilir.";
    case "product_not_found": return "Seçilen ürün katalogda bulunamadı.";
    case "variant_not_found": return "Seçilen varyant katalogda bulunamadı veya ürünle eşleşmiyor.";
    case "order_cancel_reason_required": return "Siparişi iptal etmek için neden girin.";
    case "order_return_reason_required": return "İade talebi için neden girin.";
    case "order_return_rejection_reason_required": return "İade talebini reddetmek için neden girin.";
    case "order_refund_invalid": return "Refund talebi için neden, pozitif tutar ve para birimi girin.";
    case "order_refund_rejection_reason_required": return "Refund talebini reddetmek için neden girin.";
    case "order_not_confirmed": return "Medusa sync kuyruğu için önce siparişi onaylayın.";
    case "medusa_unavailable": return "Medusa Bridge Provider erişilemiyor. Commerce OS sipariş kaydı korundu; opsiyonel sync işi kuyruğa alınmadı.";
    case "runtime_store_unavailable": return "Sipariş kayıt servisine şu anda ulaşılamıyor.";
    default: return fallback;
  }
}

export function orderLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Taslak", placed: "Oluşturuldu", confirmed: "Onaylandı", processing: "İşleniyor", completed: "Tamamlandı",
    cancelled: "İptal", archived: "Arşiv", unpaid: "Ödenmedi", authorized: "Yetkilendirildi", paid: "Ödendi",
    partially_refunded: "Kısmi refund", refunded: "Refund edildi", failed: "Başarısız", unfulfilled: "Hazırlanmadı",
    partially_fulfilled: "Kısmi hazırlandı", fulfilled: "Hazırlandı", returned: "İade", normal: "Normal", watch: "İzle",
    high: "Yüksek", blocked: "Bloke", requested: "Talep edildi", approved: "Onaylandı", rejected: "Reddedildi",
    pending: "Bekliyor", processed: "İşlendi", queued: "Kuyrukta"
  };
  return labels[value] ?? value;
}

export function OrderOperationsPanel({ initialOrders, initialSyncJobs, module, medusaHealth }: { readonly initialOrders: readonly CommerceOrderView[]; readonly initialSyncJobs: readonly CommerceOrderSyncJobView[]; readonly module?: CommerceOrderModuleView | null | undefined; readonly medusaHealth?: OrderMedusaHealthView | null | undefined }) {
  const [orders, setOrders] = useState(initialOrders); const [syncJobs, setSyncJobs] = useState(initialSyncJobs);
  const [query, setQuery] = useState(""); const [statusFilter, setStatusFilter] = useState("all"); const [paymentFilter, setPaymentFilter] = useState("all");
  const [cancelOrderId, setCancelOrderId] = useState(""); const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const moduleEnabled = module?.isEnabled === true;
  const filtered = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("tr-TR"); return orders.filter((order) => (!normalized || [order.orderId, order.sellerId, order.customerId, order.customerEmail].join(" ").toLocaleLowerCase("tr-TR").includes(normalized)) && (statusFilter === "all" || order.status === statusFilter) && (paymentFilter === "all" || order.paymentStatus === paymentFilter)); }, [orders, paymentFilter, query, statusFilter]);
  function start() { setBusy(true); setMessage(null); setError(null); }
  async function refresh() { const [ordersResponse, jobsResponse] = await Promise.all([fetch("/api/orders", { cache: "no-store" }), fetch("/api/orders/medusa-sync-jobs", { cache: "no-store" })]); const orderPayload = await readOrderJson(ordersResponse); const jobPayload = await readOrderJson(jobsResponse); if (!ordersResponse.ok || !jobsResponse.ok) { setError("Sipariş kayıtları yenilenemedi."); return; } setOrders((orderPayload.orders as CommerceOrderView[] | undefined) ?? []); setSyncJobs((jobPayload.syncJobs as CommerceOrderSyncJobView[] | undefined) ?? []); }
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); start(); const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: String(data.get("source") ?? ""), currency: String(data.get("currency") ?? ""), shippingAmount: String(data.get("shippingAmount") ?? ""), sellerId: String(data.get("sellerId") ?? ""), tenantId: String(data.get("tenantId") ?? ""), customerId: String(data.get("customerId") ?? ""), customerEmail: String(data.get("customerEmail") ?? "") }) }); const payload = await readOrderJson(response); setBusy(false); if (!response.ok) { setError(orderReadableError(payload, "Sipariş oluşturulamadı.")); return; } form.reset(); setMessage("Sipariş taslak olarak kaydedildi. Ödeme tahsilatı yapılmadı."); await refresh(); }
  async function action(orderId: string, operation: "confirm" | "mark-paid" | "mark-fulfilled" | "queue-medusa-sync") { start(); const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/${operation}`, { method: "POST" }); const payload = await readOrderJson(response); setBusy(false); if (!response.ok) { setError(orderReadableError(payload, "Sipariş işlemi uygulanamadı.")); return; } setMessage(operation === "queue-medusa-sync" ? "Medusa order sync işi kuyruğa alındı." : operation === "mark-paid" ? "İç ödeme durumu güncellendi. Tahsilat yapılmadı." : "Sipariş durumu güncellendi."); await refresh(); }
  async function cancel(event: FormEvent<HTMLFormElement>) { event.preventDefault(); start(); const response = await fetch(`/api/orders/${encodeURIComponent(cancelOrderId)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: cancelReason }) }); const payload = await readOrderJson(response); setBusy(false); if (!response.ok) { setError(orderReadableError(payload, "Sipariş iptal edilemedi.")); return; } setCancelOrderId(""); setCancelReason(""); setMessage("Sipariş neden bilgisiyle iptal edildi."); await refresh(); }
  return <div className="catalog-panel">
    {!moduleEnabled ? <section className="module-disabled-warning"><div><strong>Orders modülü pasif</strong><p>Siparişleri görebilirsiniz. Yeni kayıt ve durum işlemleri için modülü aktif edin.</p></div><Link href="/modules?highlight=orders">Orders modülünü aç</Link></section> : null}
    <section className="catalog-health-strip"><div><strong>Medusa Bridge Provider · opsiyonel order sync</strong><span>Commerce OS sipariş çekirdeği bağımsızdır. {medusaHealth?.status === "ok" ? "Provider hazır; order sync job kuyruğa alınabilir." : "Provider erişilemiyor; sipariş kayıtları korunur."}</span></div><mark data-state={medusaHealth?.status ?? "unknown"}>{medusaHealth?.status === "ok" ? "Provider hazır" : "Kısıtlı mod"}</mark></section>
    {message ? <p className="form-success">{message}</p> : null}{error ? <p className="form-error">{error}</p> : null}
    <section className="catalog-toolbar"><label>Sipariş ara<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sipariş, satıcı, müşteri veya e-posta" /></label><label>Sipariş durumu<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tümü</option><option value="draft">Taslak</option><option value="confirmed">Onaylandı</option><option value="processing">İşleniyor</option><option value="cancelled">İptal</option></select></label><label>Ödeme<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">Tümü</option><option value="unpaid">Ödenmedi</option><option value="paid">Ödendi</option><option value="partially_refunded">Kısmi refund</option><option value="refunded">Refund edildi</option></select></label></section>
    <div className="catalog-layout"><main className="catalog-main"><section className="catalog-section"><header><div><h2>Siparişler</h2><p>{filtered.length} sipariş gösteriliyor.</p></div><div className="catalog-action-row"><Link href="/orders/returns">İadeler</Link><Link href="/orders/refunds">Refundlar</Link></div></header><div className="catalog-card-list">{filtered.map((order) => <article className="catalog-record-card" key={order.orderId}><header><div><h3>{order.orderId}</h3><p>{order.customerEmail ?? order.customerId ?? "Müşteri bilgisi bekleniyor"}</p></div><mark>{orderLabel(order.status)}</mark></header><dl className="catalog-metadata"><div><dt>Ödeme</dt><dd>{orderLabel(order.paymentStatus)}</dd></div><div><dt>Hazırlama</dt><dd>{orderLabel(order.fulfillmentStatus)}</dd></div><div><dt>Risk</dt><dd>{orderLabel(order.riskStatus)}</dd></div><div><dt>Toplam</dt><dd>{order.totalAmount} {order.currency}</dd></div><div><dt>Kalem</dt><dd>{order.itemCount}</dd></div><div><dt>Satıcı</dt><dd>{order.sellerId ?? "Platform"}</dd></div></dl><div className="catalog-action-row"><Link href={`/orders/${encodeURIComponent(order.orderId)}`}>Detayı aç</Link><button disabled={busy || !moduleEnabled} onClick={() => action(order.orderId, "confirm")}>Onayla</button><button disabled={busy || !moduleEnabled} onClick={() => action(order.orderId, "mark-paid")}>Ödendi işaretle</button><button disabled={busy || !moduleEnabled} onClick={() => action(order.orderId, "mark-fulfilled")}>Hazırlandı işaretle</button><button disabled={busy || !moduleEnabled} onClick={() => setCancelOrderId(order.orderId)}>İptal et</button><button disabled={busy || !moduleEnabled || medusaHealth?.status !== "ok"} onClick={() => action(order.orderId, "queue-medusa-sync")}>Medusa kuyruğuna al</button></div></article>)}{!filtered.length ? <p className="empty-state">Henüz sipariş yok. İlk gerçek siparişi sağdaki formdan oluşturun.</p> : null}</div></section><section className="catalog-section"><header><div><h2>Medusa order sync işleri</h2><p>Doğrudan order basılmaz veya çekilmez; snapshot kayıtları iş kuyruğunda tutulur.</p></div></header><div className="catalog-card-list">{syncJobs.slice(0, 8).map((job) => <article className="catalog-record-card" key={job.jobId}><strong>{job.jobId}</strong><span>{job.orderId}</span><small>{orderLabel(job.status)} · Deneme: {job.attemptCount}</small></article>)}{!syncJobs.length ? <p className="empty-state">Henüz Medusa order sync işi yok.</p> : null}</div></section></main>
    <aside className="catalog-detail"><section><h2>Yeni sipariş</h2><p>Gerçek iç sipariş kaydı oluşturur. Ödeme tahsilatı ve kargo etiketi üretmez.</p><form className="catalog-form" onSubmit={create}><label>Kaynak<input name="source" defaultValue="central_admin" required /></label><label>Para birimi<input name="currency" defaultValue="TRY" maxLength={3} required /></label><label>Kargo tutarı<input name="shippingAmount" defaultValue="0" inputMode="decimal" /></label><label>Satıcı kodu<input name="sellerId" /></label><label>Tenant kodu<input name="tenantId" /></label><label>Müşteri kodu<input name="customerId" /></label><label>Müşteri e-postası<input name="customerEmail" type="email" /></label><button disabled={busy || !moduleEnabled}>Siparişi kaydet</button></form></section>{cancelOrderId ? <section><h2>Siparişi iptal et</h2><form className="catalog-form" onSubmit={cancel}><label>İptal nedeni<textarea required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label><div className="catalog-action-row"><button disabled={busy}>İptal et</button><button type="button" onClick={() => setCancelOrderId("")}>Vazgeç</button></div></form></section> : null}</aside></div>
  </div>;
}
