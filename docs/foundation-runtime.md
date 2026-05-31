# Foundation Runtime

This phase starts and validates the enterprise runtime only.

No marketplace UI, dashboards, demo products, fake charts, CRUD admin, landing pages, themes, animations, or fake business data are part of this phase.

## Runtime Order

1. PostgreSQL
2. Redis
3. MinIO
4. Meilisearch
5. Odoo
6. Medusa
7. Gateway API
8. Realtime service
9. Notification engine
10. AI engine

The Docker Compose dependency graph follows this order where runtime dependencies exist.

## Commands

```bash
pnpm env:validate
pnpm docker:config
pnpm docker:up
pnpm health:infra
```

## Runtime Invariants

- Odoo is the ERP engine only.
- Medusa is an optional commerce provider / bridge. Commerce OS Core catalog and order tables remain independent.
- Medusa runs `db:migrate --execute-safe-links` before the API process so schema bootstrap is idempotent and seed-free.
- Medusa packages are pinned to `2.12.2` as a consistent CLI/runtime set for this foundation.
- Medusa PostgreSQL URLs use `ssl_mode=disable` for the local Docker Postgres cluster.
- Gateway API is the only planned platform ingress.
- All runtime services join `commerce-os-network`.
- Business API routes remain reserved until domain logic is deliberately added.
- Health, topology, contracts, and security boundary endpoints do not emit business data.
