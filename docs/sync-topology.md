# Sync Topology

```mermaid
flowchart LR
  Medusa["Medusa"] --> Sync["Sync Contracts"]
  Odoo["Odoo"] --> Sync
  Sync --> Redis["Redis Streams"]
  Redis --> Realtime["Realtime"]
  Redis --> Notify["Notification Engine"]
  Redis --> AI["AI Engine"]
  Sync --> Meili["Meilisearch Indexing"]
  Sync --> MinIO["Document/Object Storage"]
```

## Event Channels

- `order`
- `inventory`
- `finance`
- `sync`
- `notification`
- `ai`

All channels are tenant-scoped and replay-ready by contract.

## Checkpoints

Sync checkpoints are defined in `@commerce-os/sync-core`. Checkpoints are tenant-scoped and system-scoped. No sync workers are mounted in this phase.
