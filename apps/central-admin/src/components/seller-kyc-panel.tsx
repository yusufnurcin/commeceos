"use client";

import { useMemo, useState } from "react";
import type { MarketplaceKycDocumentView } from "@/components/seller-onboarding-panel";

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

function documentStatus(status: string) {
  const values: Record<string, string> = {
    pending: "İnceleme bekliyor",
    approved: "Onaylı",
    rejected: "Reddedildi",
    expired: "Süresi doldu",
    needs_update: "Güncelleme gerekli"
  };
  return values[status] ?? status;
}

function readableError(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "marketplace_module_required":
      return "KYC inceleme işlemleri için önce marketplace modülünü aktif edin.";
    case "seller_kyc_document_rejection_reason_required":
      return "Belgeyi reddetmek için inceleme nedenini girin.";
    case "runtime_store_unavailable":
      return "KYC belge servisine şu anda ulaşılamıyor.";
    default:
      return fallback;
  }
}

export function SellerKycPanel({ initialDocuments }: { readonly initialDocuments: readonly MarketplaceKycDocumentView[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState(initialDocuments[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDocument = useMemo(() => documents.find((document) => document.id === selectedId), [documents, selectedId]);
  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return documents.filter((document) => {
      const statusMatches = status === "all" || document.documentStatus === status;
      const queryMatches =
        !normalized ||
        [document.fileName, document.documentType, document.applicationId, document.sellerId]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalized);
      return statusMatches && queryMatches;
    });
  }, [documents, query, status]);

  async function refreshDocuments(nextSelectedId = selectedId) {
    const response = await fetch("/api/marketplace/kyc-documents", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(readableError(payload, "KYC belgeleri alınamadı."));
      return;
    }
    const nextDocuments = (payload.kycDocuments as MarketplaceKycDocumentView[] | undefined) ?? [];
    setDocuments(nextDocuments);
    setSelectedId(nextSelectedId || nextDocuments[0]?.id || "");
  }

  async function mutateDocument(action: "approve" | "reject") {
    if (!selectedDocument) {
      return;
    }
    if (action === "reject" && !rejectionReason.trim()) {
      setError("Belgeyi reddetmek için inceleme nedenini girin.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/marketplace/kyc-documents/${encodeURIComponent(selectedDocument.id)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "reject" ? { reason: rejectionReason } : {})
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Belge inceleme işlemi uygulanamadı."));
      return;
    }
    setRejectionReason("");
    setMessage(action === "approve" ? "KYC belgesi onaylandı." : "KYC belgesi reddedildi.");
    await refreshDocuments(selectedDocument.id);
  }

  return (
    <section className="seller-kyc-panel">
      <div className="seller-toolbar">
        <label>
          Belge ara
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dosya, belge tipi veya başvuru kimliği" />
        </label>
        <label>
          Belge statüsü
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tüm belgeler</option>
            <option value="pending">İnceleme bekleyen</option>
            <option value="approved">Onaylı</option>
            <option value="rejected">Reddedildi</option>
            <option value="needs_update">Güncelleme gerekli</option>
          </select>
        </label>
        <span>{filteredDocuments.length} belge gösteriliyor</span>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="seller-kyc-layout">
        <div className="seller-document-list">
          {filteredDocuments.map((document) => (
            <article data-selected={document.id === selectedId ? "true" : "false"} key={document.id}>
              <header>
                <strong>{document.fileName}</strong>
                <mark>{documentStatus(document.documentStatus)}</mark>
              </header>
              <span>{document.documentType}</span>
              <small>Başvuru: {document.applicationId ?? "Bağlantı yok"} · Satıcı: {document.sellerId ?? "Henüz oluşmadı"}</small>
              <button onClick={() => setSelectedId(document.id)} type="button">Belgeyi İncele</button>
            </article>
          ))}
          {!filteredDocuments.length ? <p className="empty-state">Henüz KYC belge metadata kaydı yok.</p> : null}
        </div>

        <aside className="seller-onboarding-detail">
          {selectedDocument ? (
            <section>
              <h2>Belge inceleme</h2>
              <strong>{selectedDocument.fileName}</strong>
              <span>{selectedDocument.documentType} · {documentStatus(selectedDocument.documentStatus)}</span>
              <dl className="seller-metadata">
                <div><dt>Dosya türü</dt><dd>{selectedDocument.fileMimeType ?? "Belirtilmedi"}</dd></div>
                <div><dt>Dosya boyutu</dt><dd>{selectedDocument.fileSizeBytes ?? "Belirtilmedi"}</dd></div>
                <div><dt>Storage key</dt><dd>{selectedDocument.storageKey ?? "Metadata kaydı yok"}</dd></div>
                <div><dt>Checksum</dt><dd>{selectedDocument.checksum ?? "Metadata kaydı yok"}</dd></div>
              </dl>
              <label>
                Ret nedeni
                <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
              </label>
              <div className="seller-action-row">
                <button disabled={busy || selectedDocument.documentStatus === "approved"} onClick={() => mutateDocument("approve")} type="button">Belgeyi Onayla</button>
                <button disabled={busy} onClick={() => mutateDocument("reject")} type="button">Belgeyi Reddet</button>
              </div>
            </section>
          ) : <p className="empty-state">İncelemek için bir KYC belgesi seçin.</p>}
        </aside>
      </div>
    </section>
  );
}
