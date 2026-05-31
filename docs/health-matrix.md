# Health Matrix

Gateway API exposes a live health matrix at:

```text
GET /runtime/health-matrix
```

The matrix probes:

| Service | Probe | Criticality | Runtime Layer |
| --- | --- | --- | --- |
| PostgreSQL | TCP | critical | state |
| Redis | TCP | critical | cache, queues, event bus |
| MinIO | HTTP | critical | object storage |
| Meilisearch | HTTP | supporting | search index |
| Odoo | TCP | critical | ERP engine |
| Medusa | HTTP | supporting | optional commerce provider / bridge |
| Gateway API | HTTP | critical | API gateway |
| Realtime | HTTP | supporting | event fanout |
| Search | HTTP | supporting | search orchestration |
| Notification Engine | HTTP | supporting | notification orchestration |
| AI Engine | HTTP | future | AI orchestration |

`GET /ready` fails when a critical service is unavailable. Supporting and future services are reported but do not rewrite ERP or commerce source-of-truth rules. Medusa degradation does not stop Commerce OS Core catalog or order mutations; only optional sync queue requests enter controlled degraded mode.
