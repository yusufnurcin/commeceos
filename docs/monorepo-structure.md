# Monorepo Structure

```text
commerce-os-v2/
  apps/
    gateway-api/
    central-admin/
    seller-portal/
    tenant-portal/
    storefront/
    courier-app/
  services/
    medusa/
    odoo/
    realtime/
    search/
    ai-engine/
    notification-engine/
  packages/
    ui-system/
    auth-core/
    tenant-core/
    commerce-core/
    analytics-core/
    sync-core/
  infra/
    docker/
    env/
    healthchecks/
    minio/
    postgres/
  docs/
```

This structure is intentionally service-oriented and tenant-first. It is not a monolithic Laravel or CRUD-admin layout.
