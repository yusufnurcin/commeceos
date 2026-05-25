# Runtime Architecture Map

```mermaid
flowchart TB
  Apps["Experience apps\n(no business UI in foundation phase)"] --> Gateway["Gateway API"]
  Gateway --> Auth["JWT + session + service token boundary"]
  Gateway --> Tenant["Tenant + workspace resolver"]
  Gateway --> Audit["Audit + correlation + trace logging"]
  Gateway --> Medusa["Medusa API\nheadless commerce"]
  Gateway --> Odoo["Odoo API/RPC bridge\nERP engine"]
  Gateway --> Search["Search orchestration"]
  Gateway --> Realtime["Realtime channels"]
  Gateway --> Notify["Notification engine"]
  Gateway --> AI["AI orchestration slot"]

  Medusa --> PG["PostgreSQL"]
  Odoo --> PG
  Realtime --> Redis["Redis Streams"]
  Notify --> Redis
  AI --> Redis
  Search --> Meili["Meilisearch"]
  Gateway --> MinIO["MinIO"]
```

The runtime foundation exposes contracts and health only. Product, order, invoice, accounting, procurement, warehouse, HR, CRM, manufacturing, and payment business workflows are not implemented in this phase.
