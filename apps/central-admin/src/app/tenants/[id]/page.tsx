"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JsonRecord = Record<string, unknown>;

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
    return <main className="centered-runtime">Tenant runtime yükleniyor</main>;
  }

  const tenant = payload?.tenant as JsonRecord | undefined;
  const workspaces = (payload?.workspaces as readonly JsonRecord[] | undefined) ?? [];
  const auditEvents = (payload?.auditEvents as readonly JsonRecord[] | undefined) ?? [];

  return (
    <main className="detail-shell">
      <nav className="breadcrumb">
        <Link href="/">Runtime</Link>
        <Link href="/tenants/new">Tenant oluştur</Link>
          <span>{id}</span>
      </nav>
      <header className="detail-header">
        <div>
          <h1>{String(tenant?.display_name ?? tenant?.tenant_id ?? id)}</h1>
          <p>
            {String(tenant?.lifecycle_state ?? "state yok")} · {String(tenant?.default_currency ?? "currency yok")} ·{" "}
            {String(tenant?.timezone ?? "timezone yok")}
          </p>
        </div>
        <mark>{String(payload?.status ?? "unknown")}</mark>
      </header>
      <section className="runtime-section two-column">
        <article className="runtime-panel">
          <h2>Workspace registry</h2>
          {workspaces.length === 0 ? (
            <div className="empty-state">Workspace kaydı yok.</div>
          ) : (
            workspaces.map((workspace) => (
              <div className="data-row" key={String(workspace.workspace_id)}>
                <strong>{String(workspace.workspace_type)}</strong>
                <span>{String(workspace.workspace_id)}</span>
              </div>
            ))
          )}
        </article>
        <article className="runtime-panel">
          <h2>Namespace ve bridge state</h2>
          <pre>{JSON.stringify({ namespaces: payload?.namespaces, bridgeState: payload?.bridgeState }, null, 2)}</pre>
        </article>
      </section>
      <section className="runtime-section">
        <h2>Audit events</h2>
        {auditEvents.length === 0 ? (
          <div className="empty-state">Bu tenant için audit olayı henüz oluşmadı.</div>
        ) : (
          <div className="audit-list">
            {auditEvents.map((event, index) => (
              <pre key={index}>{JSON.stringify(event, null, 2)}</pre>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
