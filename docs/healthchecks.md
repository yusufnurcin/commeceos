# Healthcheck Strategy

Healthchecks are intentionally shallow during foundation setup.

## Docker Healthchecks

The Compose stack defines healthchecks for:

- PostgreSQL through `pg_isready`
- Redis through `redis-cli ping`
- Meilisearch through `/health`
- MinIO through `mc ready`
- Odoo through TCP socket readiness on `8069`
- Medusa through `/health`
- Gateway through `/health`

## App Health Routes

Each Next.js app exposes:

```text
/health
```

The route returns an infrastructure liveness payload only. No business UI, fake metrics, demo commerce data, or admin CRUD is mounted.

## Service Health Routes

Node service shells expose:

```text
/health
/ready
```

Readiness should become dependency-aware when business modules are introduced.
