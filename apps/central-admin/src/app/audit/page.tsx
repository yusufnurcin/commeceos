"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AuditEvent = {
  readonly audit_id?: string;
  readonly action?: string;
  readonly result?: string;
  readonly tenant_id?: string;
  readonly workspace_id?: string;
  readonly occurred_at?: string;
};

export default function AuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<readonly AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return { events: [] };
        }
        return (await response.json()) as { readonly events?: readonly AuditEvent[] };
      })
      .then((payload) => setEvents(payload.events ?? []))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="detail-shell">
      <nav className="breadcrumb">
        <Link href="/">Runtime</Link>
        <span>Audit Center</span>
      </nav>
      <header className="detail-header">
        <div>
          <h1>Audit Center</h1>
          <p>Login, failed login, tenant_created, session_revoked ve runtime warning görünürlüğü.</p>
        </div>
        <mark>{loading ? "loading" : `${events.length} event`}</mark>
      </header>
      {events.length === 0 ? (
        <div className="empty-state">
          <strong>Audit olayı bekleniyor</strong>
          <p>Gerçek auth veya provisioning olayı oluştuğunda bu liste dolacak.</p>
        </div>
      ) : (
        <section className="audit-list">
          {events.map((event) => (
            <article className="audit-item" key={event.audit_id ?? `${event.action}-${event.occurred_at}`}>
              <strong>{event.action}</strong>
              <span>{event.result}</span>
              <small>
                {event.tenant_id ?? "tenant yok"} · {event.workspace_id ?? "workspace yok"} · {event.occurred_at}
              </small>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
