"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type {
  MarketplaceApplicationView,
  MarketplaceKycDocumentView,
  MarketplaceSellerView
} from "@/components/seller-onboarding-panel";

interface MarketplaceSellerEventView {
  readonly id: string;
  readonly event_type: string;
  readonly created_at: string;
}

function sellerStatus(status: string) {
  const values: Record<string, string> = {
    approved: "Onaylı",
    suspended: "Askıya alındı",
    rejected: "Reddedildi",
    archived: "Arşivlendi"
  };
  return values[status] ?? status;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

export function SellerDetailPanel({
  initialSeller,
  initialApplications,
  initialDocuments,
  initialEvents
}: {
  readonly initialSeller: MarketplaceSellerView;
  readonly initialApplications: readonly MarketplaceApplicationView[];
  readonly initialDocuments: readonly MarketplaceKycDocumentView[];
  readonly initialEvents: readonly MarketplaceSellerEventView[];
}) {
  const [seller, setSeller] = useState(initialSeller);
  const [events, setEvents] = useState(initialEvents);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshSeller() {
    const response = await fetch(`/api/marketplace/sellers/${encodeURIComponent(seller.sellerId)}`, { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError("Satıcı detayı yenilenemedi.");
      return;
    }
    setSeller(payload.seller as MarketplaceSellerView);
    setEvents((payload.events as MarketplaceSellerEventView[] | undefined) ?? []);
  }

  async function suspendSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/marketplace/sellers/${encodeURIComponent(seller.sellerId)}/suspend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(payload.status === "seller_suspend_reason_required" ? "Satıcıyı askıya almak için neden girin." : "Satıcı askıya alınamadı.");
      return;
    }
    setReason("");
    setMessage("Satıcı askıya alındı.");
    await refreshSeller();
  }

  async function reactivateSeller() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/marketplace/sellers/${encodeURIComponent(seller.sellerId)}/reactivate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    setBusy(false);
    if (!response.ok) {
      setError("Satıcı yeniden aktifleştirilemedi.");
      return;
    }
    setMessage("Satıcı yeniden aktifleştirildi.");
    await refreshSeller();
  }

  return (
    <section className="seller-detail-panel">
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="seller-detail-grid">
        <section className="seller-section">
          <header>
            <div>
              <h2>{seller.displayName}</h2>
              <p>{seller.legalName}</p>
            </div>
            <mark>{sellerStatus(seller.status)}</mark>
          </header>
          <dl className="seller-metadata">
            <div><dt>Satıcı kimliği</dt><dd>{seller.sellerId}</dd></div>
            <div><dt>Tip</dt><dd>{seller.sellerType}</dd></div>
            <div><dt>Risk</dt><dd>{seller.riskStatus}</dd></div>
            <div><dt>Ülke / para birimi</dt><dd>{seller.country} / {seller.currency}</dd></div>
            <div><dt>E-posta</dt><dd>{seller.email ?? "Belirtilmedi"}</dd></div>
            <div><dt>KYC</dt><dd>{seller.approvedKycDocumentCount}/{seller.kycDocumentCount} belge onaylı</dd></div>
          </dl>
          {seller.status === "approved" ? (
            <form className="seller-form" onSubmit={suspendSeller}>
              <label>Askıya alma nedeni<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              <button disabled={busy} type="submit">Satıcıyı Askıya Al</button>
            </form>
          ) : null}
          {seller.status === "suspended" ? <button disabled={busy} onClick={reactivateSeller} type="button">Satıcıyı Yeniden Aktifleştir</button> : null}
        </section>

        <section className="seller-section">
          <h2>Başvuru geçmişi</h2>
          <div className="seller-document-list">
            {initialApplications.map((application) => (
              <article key={application.applicationId}>
                <strong>{application.applicationId}</strong>
                <span>{application.status} · {application.reviewStatus}</span>
                <small>{application.email}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="seller-section">
          <h2>KYC belgeleri</h2>
          <div className="seller-document-list">
            {initialDocuments.map((document) => (
              <article key={document.id}>
                <strong>{document.fileName}</strong>
                <span>{document.documentType} · {document.documentStatus}</span>
              </article>
            ))}
          </div>
          <Link href="/marketplace/kyc">KYC Merkezi&apos;ni aç</Link>
        </section>

        <section className="seller-section">
          <h2>Olay geçmişi</h2>
          <div className="seller-event-list">
            {events.slice(0, 15).map((event) => (
              <article key={event.id}>
                <strong>{event.event_type}</strong>
                <span>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
