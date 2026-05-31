"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

export interface MarketplaceModuleView {
  readonly key: string;
  readonly isEnabled: boolean;
  readonly status: string;
}

export interface MarketplaceSellerView {
  readonly sellerId: string;
  readonly displayName: string;
  readonly legalName?: string | null;
  readonly sellerType: string;
  readonly status: string;
  readonly riskStatus: string;
  readonly country: string;
  readonly currency: string;
  readonly email?: string | null;
  readonly kycDocumentCount: number;
  readonly approvedKycDocumentCount: number;
}

export interface MarketplaceApplicationView {
  readonly applicationId: string;
  readonly sellerId?: string | null;
  readonly displayName: string;
  readonly legalName: string;
  readonly sellerType: string;
  readonly country: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly taxNumber?: string | null;
  readonly status: string;
  readonly reviewStatus: string;
  readonly reviewNotes?: string | null;
  readonly kycDocumentCount: number;
  readonly approvedKycDocumentCount: number;
  readonly createdAt: string;
}

export interface MarketplaceKycDocumentView {
  readonly id: string;
  readonly sellerId?: string | null;
  readonly applicationId?: string | null;
  readonly documentType: string;
  readonly documentStatus: string;
  readonly fileName: string;
  readonly fileMimeType?: string | null;
  readonly fileSizeBytes?: number | null;
  readonly storageKey?: string | null;
  readonly checksum?: string | null;
  readonly rejectionReason?: string | null;
  readonly metadata?: unknown;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

function readableError(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "marketplace_module_required":
      return "Satıcı onboarding işlemleri için önce Modül Merkezi'nden marketplace modülünü aktif edin.";
    case "seller_application_invalid":
      return "Başvuru alanlarını kontrol edin. Mağaza adı, yasal unvan, satıcı tipi, ülke ve geçerli e-posta zorunlu.";
    case "seller_application_kyc_incomplete":
      return "Başvuruyu onaylamak için en az bir KYC belgesi ekleyin ve tüm belgeleri onaylayın.";
    case "seller_application_rejection_reason_required":
      return "Başvuruyu reddetmek için inceleme notu girin.";
    case "seller_application_not_submittable":
      return "Bu başvuru daha önce gönderilmiş veya artık gönderime açık değil.";
    case "seller_kyc_document_invalid":
      return "Belge tipi ve dosya adı zorunlu. Dosya boyutu negatif olamaz.";
    case "runtime_store_unavailable":
      return "Satıcı kayıt servisine şu anda ulaşılamıyor.";
    default:
      return fallback;
  }
}

function sellerStatus(status: string) {
  const values: Record<string, string> = {
    draft: "Taslak",
    pending_review: "İnceleme bekliyor",
    approved: "Onaylı",
    rejected: "Reddedildi",
    suspended: "Askıya alındı",
    archived: "Arşivlendi"
  };
  return values[status] ?? status;
}

function applicationStatus(status: string) {
  const values: Record<string, string> = {
    draft: "Taslak",
    submitted: "Gönderildi",
    under_review: "İnceleniyor",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    cancelled: "İptal edildi"
  };
  return values[status] ?? status;
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

export function SellerOnboardingPanel({
  initialSellers,
  initialApplications,
  module
}: {
  readonly initialSellers: readonly MarketplaceSellerView[];
  readonly initialApplications: readonly MarketplaceApplicationView[];
  readonly module?: MarketplaceModuleView | null;
}) {
  const [sellers, setSellers] = useState(initialSellers);
  const [applications, setApplications] = useState(initialApplications);
  const [selectedApplicationId, setSelectedApplicationId] = useState(initialApplications[0]?.applicationId ?? "");
  const [documents, setDocuments] = useState<readonly MarketplaceKycDocumentView[]>([]);
  const [query, setQuery] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moduleEnabled = module?.isEnabled === true;
  const selectedApplication = useMemo(
    () => applications.find((application) => application.applicationId === selectedApplicationId),
    [applications, selectedApplicationId]
  );
  const filteredApplications = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return applications.filter((application) => {
      const statusMatches = applicationFilter === "all" || application.status === applicationFilter;
      const queryMatches =
        !normalized ||
        [application.displayName, application.legalName, application.email, application.applicationId]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalized);
      return statusMatches && queryMatches;
    });
  }, [applications, applicationFilter, query]);
  const filteredSellers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return sellers.filter((seller) => {
      const statusMatches = sellerFilter === "all" || seller.status === sellerFilter;
      const queryMatches =
        !normalized ||
        [seller.displayName, seller.legalName, seller.email, seller.sellerId]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalized);
      return statusMatches && queryMatches;
    });
  }, [sellers, sellerFilter, query]);

  function startAction() {
    setBusy(true);
    setMessage(null);
    setError(null);
  }

  async function refreshApplications(nextSelectedId = selectedApplicationId) {
    const [sellerResponse, applicationResponse] = await Promise.all([
      fetch("/api/marketplace/sellers", { cache: "no-store" }),
      fetch("/api/marketplace/seller-applications", { cache: "no-store" })
    ]);
    const sellerPayload = await readJson(sellerResponse);
    const applicationPayload = await readJson(applicationResponse);
    if (!sellerResponse.ok || !applicationResponse.ok) {
      setError("Satıcı ve başvuru listeleri yenilenemedi.");
      return;
    }
    const nextSellers = (sellerPayload.sellers as MarketplaceSellerView[] | undefined) ?? [];
    const nextApplications = (applicationPayload.applications as MarketplaceApplicationView[] | undefined) ?? [];
    setSellers(nextSellers);
    setApplications(nextApplications);
    setSelectedApplicationId(nextSelectedId || nextApplications[0]?.applicationId || "");
  }

  async function loadDocuments(applicationId: string) {
    setSelectedApplicationId(applicationId);
    const response = await fetch(`/api/marketplace/seller-applications/${encodeURIComponent(applicationId)}/kyc-documents`, {
      cache: "no-store"
    });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(readableError(payload, "KYC belgeleri alınamadı."));
      return;
    }
    setDocuments((payload.kycDocuments as MarketplaceKycDocumentView[] | undefined) ?? []);
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startAction();
    const response = await fetch("/api/marketplace/seller-applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(data.get("displayName") ?? ""),
        legalName: String(data.get("legalName") ?? ""),
        sellerType: String(data.get("sellerType") ?? ""),
        country: String(data.get("country") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        taxNumber: String(data.get("taxNumber") ?? ""),
        providerContext: { providerReady: false }
      })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Başvuru oluşturulamadı."));
      return;
    }
    const application = payload.application as MarketplaceApplicationView;
    form.reset();
    setMessage("Satıcı başvurusu taslak olarak kaydedildi.");
    await refreshApplications(application.applicationId);
    await loadDocuments(application.applicationId);
  }

  async function mutateApplication(action: "submit" | "approve" | "reject") {
    if (!selectedApplication) {
      return;
    }
    startAction();
    const response = await fetch(
      `/api/marketplace/seller-applications/${encodeURIComponent(selectedApplication.applicationId)}/${action}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: reviewNotes } : {})
      }
    );
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Başvuru işlemi uygulanamadı."));
      return;
    }
    setReviewNotes("");
    setMessage(action === "submit" ? "Başvuru incelemeye gönderildi." : action === "approve" ? "Başvuru onaylandı ve satıcı kaydı oluşturuldu." : "Başvuru reddedildi.");
    await refreshApplications(selectedApplication.applicationId);
    await loadDocuments(selectedApplication.applicationId);
  }

  async function addKycDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedApplication) {
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    startAction();
    const response = await fetch(
      `/api/marketplace/seller-applications/${encodeURIComponent(selectedApplication.applicationId)}/kyc-documents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentType: String(data.get("documentType") ?? ""),
          fileName: String(data.get("fileName") ?? ""),
          fileMimeType: String(data.get("fileMimeType") ?? ""),
          fileSizeBytes: Number(data.get("fileSizeBytes") ?? 0),
          storageKey: String(data.get("storageKey") ?? ""),
          checksum: String(data.get("checksum") ?? ""),
          metadata: { source: "central_admin_metadata_entry" }
        })
      }
    );
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "KYC belge metadata kaydı oluşturulamadı."));
      return;
    }
    form.reset();
    setMessage("KYC belge metadata kaydı eklendi. Bu fazda dosya yükleme yapılmadı.");
    await refreshApplications(selectedApplication.applicationId);
    await loadDocuments(selectedApplication.applicationId);
  }

  async function mutateDocument(documentId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Belge reddetme nedenini yazın.")?.trim() : undefined;
    if (action === "reject" && !reason) {
      setError("Belgeyi reddetmek için neden girin.");
      return;
    }
    startAction();
    const response = await fetch(`/api/marketplace/kyc-documents/${encodeURIComponent(documentId)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {})
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Belge inceleme işlemi uygulanamadı."));
      return;
    }
    setMessage(action === "approve" ? "KYC belgesi onaylandı." : "KYC belgesi reddedildi.");
    if (selectedApplication) {
      await refreshApplications(selectedApplication.applicationId);
      await loadDocuments(selectedApplication.applicationId);
    }
  }

  return (
    <section className="seller-onboarding-panel">
      {!moduleEnabled ? (
        <div className="module-disabled-warning">
          <strong>Marketplace modülü pasif</strong>
          <span>Listeler okunabilir; başvuru ve KYC işlemleri için marketplace modülünü aktif edin.</span>
          <Link href="/modules?highlight=marketplace">Modül Merkezi</Link>
        </div>
      ) : null}

      <div className="seller-toolbar">
        <label>
          Satıcı veya başvuru ara
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mağaza, e-posta veya kayıt kimliği" />
        </label>
        <label>
          Başvuru statüsü
          <select value={applicationFilter} onChange={(event) => setApplicationFilter(event.target.value)}>
            <option value="all">Tüm başvurular</option>
            <option value="draft">Taslak</option>
            <option value="submitted">Gönderildi</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>
        </label>
        <label>
          Satıcı statüsü
          <select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}>
            <option value="all">Tüm satıcılar</option>
            <option value="approved">Onaylı</option>
            <option value="suspended">Askıya alınan</option>
          </select>
        </label>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="seller-onboarding-layout">
        <div className="seller-onboarding-main">
          <section className="seller-section">
            <header>
              <div>
                <h2>Satıcı başvuruları</h2>
                <p>{filteredApplications.length} gerçek başvuru kaydı</p>
              </div>
            </header>
            <div className="seller-card-list">
              {filteredApplications.map((application) => (
                <article className="seller-record-card" data-selected={application.applicationId === selectedApplicationId ? "true" : "false"} key={application.applicationId}>
                  <header>
                    <div>
                      <h3>{application.displayName}</h3>
                      <p>{application.legalName}</p>
                    </div>
                    <mark>{applicationStatus(application.status)}</mark>
                  </header>
                  <span>{application.email} · {application.country} · {application.sellerType}</span>
                  <small>KYC: {application.approvedKycDocumentCount}/{application.kycDocumentCount} belge onaylı</small>
                  <button type="button" onClick={() => loadDocuments(application.applicationId)}>İncele</button>
                </article>
              ))}
              {!filteredApplications.length ? <p className="empty-state">Henüz satıcı başvurusu yok. İlk gerçek başvuruyu sağdaki formdan oluşturun.</p> : null}
            </div>
          </section>

          <section className="seller-section">
            <header>
              <div>
                <h2>Onaylı satıcılar</h2>
                <p>{filteredSellers.length} gerçek satıcı kaydı</p>
              </div>
            </header>
            <div className="seller-card-list">
              {filteredSellers.map((seller) => (
                <article className="seller-record-card" key={seller.sellerId}>
                  <header>
                    <div>
                      <h3>{seller.displayName}</h3>
                      <p>{seller.legalName}</p>
                    </div>
                    <mark>{sellerStatus(seller.status)}</mark>
                  </header>
                  <span>Risk: {seller.riskStatus} · {seller.country} · {seller.currency}</span>
                  <small>KYC: {seller.approvedKycDocumentCount}/{seller.kycDocumentCount} belge onaylı</small>
                  <Link href={`/marketplace/sellers/${encodeURIComponent(seller.sellerId)}`}>Satıcı detayını aç</Link>
                </article>
              ))}
              {!filteredSellers.length ? <p className="empty-state">Henüz onaylı satıcı yok. İncelenen başvurular onaylandığında burada görünür.</p> : null}
            </div>
          </section>
        </div>

        <aside className="seller-onboarding-detail">
          <section>
            <h2>Yeni satıcı başvurusu</h2>
            <form className="seller-form" onSubmit={createApplication}>
              <label>Mağaza adı<input name="displayName" required /></label>
              <label>Yasal unvan<input name="legalName" required /></label>
              <label>Satıcı tipi<select name="sellerType"><option value="company">Şirket</option><option value="individual">Bireysel</option></select></label>
              <label>Ülke<input defaultValue="TR" maxLength={2} name="country" required /></label>
              <label>E-posta<input name="email" required type="email" /></label>
              <label>Telefon<input name="phone" /></label>
              <label>Vergi numarası<input name="taxNumber" /></label>
              <button disabled={!moduleEnabled || busy} type="submit">Başvuruyu Kaydet</button>
            </form>
          </section>

          {selectedApplication ? (
            <section>
              <h2>Başvuru inceleme</h2>
              <strong>{selectedApplication.displayName}</strong>
              <span>{applicationStatus(selectedApplication.status)} · KYC {selectedApplication.approvedKycDocumentCount}/{selectedApplication.kycDocumentCount}</span>
              <div className="seller-action-row">
                <button disabled={busy || selectedApplication.status !== "draft"} onClick={() => mutateApplication("submit")} type="button">İncelemeye Gönder</button>
                <button disabled={busy || !["submitted", "under_review"].includes(selectedApplication.status)} onClick={() => mutateApplication("approve")} type="button">Onayla</button>
              </div>
              <label>Ret notu<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} /></label>
              <button disabled={busy || selectedApplication.status === "approved"} onClick={() => mutateApplication("reject")} type="button">Başvuruyu Reddet</button>
            </section>
          ) : null}

          {selectedApplication ? (
            <section>
              <h2>KYC belge metadata</h2>
              <form className="seller-form" onSubmit={addKycDocument}>
                <label>Belge tipi<select name="documentType"><option value="tax_certificate">Vergi levhası</option><option value="identity">Kimlik belgesi</option><option value="trade_registry">Ticaret sicil belgesi</option></select></label>
                <label>Dosya adı<input name="fileName" placeholder="vergi-levhasi.pdf" required /></label>
                <label>Dosya türü<input name="fileMimeType" placeholder="application/pdf" /></label>
                <label>Dosya boyutu<input min="0" name="fileSizeBytes" type="number" /></label>
                <label>Storage key<input name="storageKey" placeholder="Opsiyonel" /></label>
                <label>Checksum<input name="checksum" placeholder="Opsiyonel" /></label>
                <button disabled={!moduleEnabled || busy} type="submit">Belge Metadata Ekle</button>
              </form>
              <div className="seller-document-list">
                {documents.map((document) => (
                  <article key={document.id}>
                    <strong>{document.fileName}</strong>
                    <span>{document.documentType} · {documentStatus(document.documentStatus)}</span>
                    <div className="seller-action-row">
                      <button disabled={busy || document.documentStatus === "approved"} onClick={() => mutateDocument(document.id, "approve")} type="button">Belgeyi Onayla</button>
                      <button disabled={busy} onClick={() => mutateDocument(document.id, "reject")} type="button">Reddet</button>
                    </div>
                  </article>
                ))}
                {!documents.length ? <p className="empty-state">Bu başvuruda henüz KYC belge metadata kaydı yok.</p> : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
