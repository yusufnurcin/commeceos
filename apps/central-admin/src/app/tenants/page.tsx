import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminShell,
  DataToolbar,
  EmptyOperationalState,
  OperationGrid,
  PageHeader,
  ServiceStatusCard
} from "@/components/admin";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { getManagementAreaByHref } from "@/config/management";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

interface TenantRow {
  readonly tenant_id?: string;
  readonly display_name?: string;
  readonly lifecycle_state?: string;
  readonly default_locale?: string;
  readonly default_currency?: string;
}

export default async function TenantListPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const response = await gatewayFetchWithRefresh("/v1/tenants", {}, { allowCookieMutation: false });
  const payload = (await readJson(response)) as { readonly tenants?: readonly TenantRow[] };
  const item = findNavigationItemByHref("/tenants") ?? navigationManifest[1]!;
  const area = getManagementAreaByHref("/tenants")!;
  const tenants = payload.tenants ?? [];

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          label: "Tenant Yönetimi",
          description: "Kiracı yaşam döngüsü, domain, kullanıcı, fatura, modül ve izolasyon alanlarını yönetin."
        }}
        principal={session.principal}
        actions={
          <Link className="primary-link" href="/tenants/new">
            Yeni Tenant Oluştur
          </Link>
        }
      />

      <section className="management-intro-grid">
        <section className="dashboard-section">
          <DataToolbar title="Tenant listesi" description="Gerçek Gateway tenant registry kayıtları." />
          {tenants.length ? (
            <div className="tenant-table">
              {tenants.map((tenant) => (
                <Link href={`/tenants/${tenant.tenant_id}`} key={tenant.tenant_id} className="tenant-row">
                  <strong>{tenant.display_name ?? tenant.tenant_id}</strong>
                  <span>{tenant.lifecycle_state ?? "Durum bekleniyor"}</span>
                  <small>
                    {tenant.default_locale ?? "Dil yok"} · {tenant.default_currency ?? "Para birimi yok"}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyOperationalState
              title="Henüz tenant yok"
              description="İlk tenant'ı oluşturduğunuzda domain, workspace, fatura ve kullanıcı kartları burada yönetilebilir hale gelir."
              actionLabel="Yeni Tenant Oluştur"
              href="/tenants/new"
            />
          )}
        </section>

        <section className="dashboard-section">
          <DataToolbar title="Tenant yönetim adımları" description="İlk tenant sonrası sırayla tamamlanacak alanlar." />
          <div className="service-status-grid single-column">
            <ServiceStatusCard label="Domain" status="Hazırlanıyor" detail="Tenant domain ve SSL/DNS adımı tenant seçildikten sonra açılır." tone="setup" />
            <ServiceStatusCard label="Fatura" status="Hazırlanıyor" detail="SaaS fatura ve abonelik alanı tenant kaydıyla ilişkilenecek." tone="planned" />
            <ServiceStatusCard label="Kullanıcılar" status="Hazırlanıyor" detail="Tenant admin ve ekip davetleri tenant detayından yönetilir." tone="planned" />
          </div>
        </section>
      </section>

      <section className="dashboard-section">
        <DataToolbar title="Tenant modülleri" description="Alt işlemler sidebar'a yığılmaz; tenant ekranında iş kartı olarak görünür." />
        <OperationGrid operations={area.operations} />
      </section>
    </AdminShell>
  );
}
