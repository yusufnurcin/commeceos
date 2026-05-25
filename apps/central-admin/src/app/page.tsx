"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JsonRecord = Record<string, unknown>;

interface DashboardPayload {
  readonly status: string;
  readonly me?: {
    readonly principal?: {
      readonly name?: string | null;
      readonly email?: string | null;
      readonly roles?: readonly string[];
      readonly workspaceId?: string;
      readonly tenantId?: string;
    };
    readonly session?: {
      readonly status?: string;
      readonly sessionId?: string;
    };
  };
  readonly healthMatrix?: {
    readonly status?: string;
    readonly entries?: readonly {
      readonly service?: string;
      readonly layer?: string;
      readonly status?: string;
      readonly latencyMs?: number;
    }[];
  };
  readonly medusaHealth?: JsonRecord;
  readonly tenants?: { readonly tenants?: readonly JsonRecord[] };
  readonly queue?: { readonly queueStates?: readonly JsonRecord[]; readonly deadLetters?: readonly JsonRecord[] };
  readonly audit?: { readonly events?: readonly JsonRecord[] };
}

function EmptyOperationalState({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function serviceStatus(payload: DashboardPayload, service: string) {
  return payload.healthMatrix?.entries?.find((entry) => entry.service === service);
}

export default function CentralAdminPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/runtime/dashboard", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        const body = (await response.json()) as DashboardPayload;
        if (!response.ok) {
          throw new Error(body.status || "runtime_error");
        }
        return body;
      })
      .then((body) => {
        if (mounted && body) {
          setPayload(body);
        }
      })
      .catch((requestError: unknown) => {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : "runtime_error");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const statusRows = useMemo(() => {
    if (!payload) {
      return [];
    }
    return ["gateway-api", "medusa", "odoo", "realtime", "postgres", "redis", "minio", "meilisearch"].map((service) => ({
      service,
      entry: serviceStatus(payload, service)
    }));
  }, [payload]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) {
    return <main className="centered-runtime">Runtime oturumu doğrulanıyor</main>;
  }

  if (error || !payload) {
    return (
      <main className="centered-runtime">
        <EmptyOperationalState title="Runtime erişimi kurulamadı" detail={error ?? "Gateway yanıtı alınamadı."} />
      </main>
    );
  }

  const principal = payload.me?.principal;
  const tenantCount = payload.tenants?.tenants?.length ?? 0;
  const queueCount = payload.queue?.queueStates?.length ?? 0;
  const auditCount = payload.audit?.events?.length ?? 0;

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <div className="brand-panel">
          <div className="brand-mark-large">ZC</div>
          <div>
            <strong>Commerce OS</strong>
            <span>Central Admin</span>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Central Admin">
          <Link href="/">Runtime</Link>
          <Link href="/tenants/new">Tenant Oluştur</Link>
          <Link href="/audit">Audit Center</Link>
        </nav>
        <button className="ghost-button" type="button" onClick={logout}>
          Çıkış
        </button>
      </aside>

      <section className="main-stage">
        <header className="runtime-hero">
          <div>
            <h1>Operasyon erişimi aktif</h1>
            <p>
              {principal?.name ?? principal?.email ?? "Super admin"} · {principal?.roles?.join(", ") ?? "role yok"} ·{" "}
              {principal?.workspaceId ?? "workspace yok"}
            </p>
          </div>
          <div className="session-panel">
            <span>Session</span>
            <strong>{payload.me?.session?.status ?? "bilinmiyor"}</strong>
            <small>{payload.me?.session?.sessionId ?? "session id bekleniyor"}</small>
          </div>
        </header>

        <section className="metric-strip" aria-label="Gerçek runtime sayımları">
          <article>
            <span>Gateway</span>
            <strong>{payload.healthMatrix?.status ?? "unknown"}</strong>
          </article>
          <article>
            <span>Tenant</span>
            <strong>{tenantCount}</strong>
          </article>
          <article>
            <span>Queue State</span>
            <strong>{queueCount}</strong>
          </article>
          <article>
            <span>Audit Event</span>
            <strong>{auditCount}</strong>
          </article>
        </section>

        <section className="runtime-section">
          <div className="section-title">
            <h2>Runtime health</h2>
            <Link href="/audit">Audit görünürlüğü</Link>
          </div>
          <div className="health-grid">
            {statusRows.map(({ service, entry }) => (
              <article className="health-row" key={service}>
                <div>
                  <strong>{service}</strong>
                  <span>{entry?.layer ?? "layer bekleniyor"}</span>
                </div>
                <mark data-state={entry?.status ?? "unknown"}>{entry?.status ?? "unknown"}</mark>
                <small>{typeof entry?.latencyMs === "number" ? `${entry.latencyMs} ms` : "latency yok"}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="runtime-section two-column">
          <article className="runtime-panel">
            <h2>Medusa</h2>
            <pre>{JSON.stringify(payload.medusaHealth ?? {}, null, 2)}</pre>
          </article>
          <article className="runtime-panel">
            <h2>Queue / Audit</h2>
            {queueCount === 0 && auditCount === 0 ? (
              <EmptyOperationalState title="Operasyon kaydı bekleniyor" detail="Gerçek queue veya audit olayı oluştuğunda burada görünür." />
            ) : (
              <pre>{JSON.stringify({ queue: payload.queue?.queueStates, audit: payload.audit?.events }, null, 2)}</pre>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
