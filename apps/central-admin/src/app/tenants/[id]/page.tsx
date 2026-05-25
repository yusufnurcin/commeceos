"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JsonRecord = Record<string, unknown>;

function value(source: JsonRecord | undefined, key: string, fallback: string) {
  const next = source?.[key];
  return typeof next === "string" && next ? next : fallback;
}

export default function TenantDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [payload, setPayload] = useState<JsonRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tenants/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        return (await response.json()) as JsonRecord;
      })
      .then((body) => setPayload(body))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return <main className="centered-runtime">Tenant bilgileri yükleniyor</main>;
  }

  const tenant = payload?.tenant as JsonRecord | undefined;
  const workspaces = (payload?.workspaces as readonly JsonRecord[] | undefined) ?? [];
  const auditEvents = (payload?.auditEvents as readonly JsonRecord[] | undefined) ?? [];
  const namespaces = (payload?.namespaces as JsonRecord | undefined) ?? {};
  const bridgeState = (payload?.bridgeState as JsonRecord | undefined) ?? {};

  return (
    <main className="detail-shell">
      <nav className="breadcrumb">
        <Link href="/">Ana Panel</Link>
        <Link href="/tenants">Tenantlar</Link>
        <span>{id}</span>
      </nav>
      <header className="detail-header">
        <div>
          <h1>{value(tenant, "display_name", value(tenant, "tenant_id", id))}</h1>
          <p>
            {value(tenant, "lifecycle_state", "Durum bekleniyor")} · {value(tenant, "default_currency", "Para birimi yok")} ·{" "}
            {value(tenant, "timezone", "Zaman dilimi yok")}
          </p>
        </div>
        <mark>{String(payload?.status ?? "Hazırlanıyor")}</mark>
      </header>
      <section className="runtime-section two-column">
        <article className="runtime-panel">
          <h2>Workspace listesi</h2>
          {workspaces.length === 0 ? (
            <div className="empty-state">Bu tenant için workspace kaydı henüz oluşmadı.</div>
          ) : (
            workspaces.map((workspace) => (
              <div className="data-row" key={String(workspace.workspace_id)}>
                <strong>{String(workspace.workspace_type ?? "Workspace")}</strong>
                <span>{String(workspace.workspace_id ?? "Kimlik bekleniyor")}</span>
              </div>
            ))
          )}
        </article>
        <article className="runtime-panel">
          <h2>İzolasyon ve köprü durumu</h2>
          <div className="operation-grid">
            <div className="operation-card">
              <strong>Depolama Alanı</strong>
              <span>{String(namespaces.storage ?? "Storage alanı tenant provisioning ile oluşacak.")}</span>
            </div>
            <div className="operation-card">
              <strong>Realtime Kanalı</strong>
              <span>{String(namespaces.realtime ?? "Realtime kanalı tenant aktifleşince bağlanacak.")}</span>
            </div>
            <div className="operation-card">
              <strong>Odoo Köprüsü</strong>
              <span>{String(bridgeState.odoo ?? "Odoo mapping bekleniyor.")}</span>
            </div>
            <div className="operation-card">
              <strong>Medusa Köprüsü</strong>
              <span>{String(bridgeState.medusa ?? "Medusa bridge bekleniyor.")}</span>
            </div>
          </div>
        </article>
      </section>
      <section className="runtime-section">
        <h2>Audit olayları</h2>
        {auditEvents.length === 0 ? (
          <div className="empty-state">Bu tenant için audit olayı henüz oluşmadı.</div>
        ) : (
          <div className="audit-mini-timeline">
            {auditEvents.map((event, index) => (
              <article key={String(event.audit_id ?? index)}>
                <strong>{String(event.action ?? "Tenant olayı")}</strong>
                <span>{String(event.result ?? "Sonuç bekleniyor")}</span>
                <small>{String(event.occurred_at ?? "Zaman bekleniyor")}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
