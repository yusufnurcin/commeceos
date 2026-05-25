# Service Topology

```mermaid
flowchart LR
  subgraph "commerce-os-network"
    PG["PostgreSQL"]
    Redis["Redis"]
    MinIO["MinIO"]
    Meili["Meilisearch"]
    Odoo["Odoo ERP Engine"]
    Medusa["Medusa Headless Commerce"]
    Search["Search Service"]
    Gateway["Gateway API"]
    Realtime["Realtime Service"]
    Notify["Notification Engine"]
    AI["AI Engine"]
  end

  Odoo --> PG
  Medusa --> PG
  Medusa --> Redis
  Search --> Meili
  Gateway --> PG
  Gateway --> Redis
  Gateway --> MinIO
  Gateway --> Meili
  Gateway --> Odoo
  Gateway --> Medusa
  Realtime --> Redis
  Realtime --> Gateway
  Notify --> Redis
  Notify --> Gateway
  AI --> Gateway
```

Service discovery uses Docker DNS names, not host ports:

- `postgres:5432`
- `redis:6379`
- `minio:9000`
- `meilisearch:7700`
- `odoo:8069`
- `medusa:9000`
- `gateway-api:8080`
- `realtime:8091`
- `search:8092`
- `ai-engine:8093`
- `notification-engine:8094`
