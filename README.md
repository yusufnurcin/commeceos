# Commerce OS v2

Enterprise-grade commerce operating system foundation.

This repository is intentionally only the technical foundation layer. It does not contain storefront templates, CRUD-heavy admin panels, fake dashboards, demo products, fake analytics, or raw Odoo end-user UI.

## Architecture Intent

- Multi-tenant commerce operating system
- Marketplace, SaaS, and ERP orchestration foundation
- Odoo as the backend ERP engine only
- MedusaJS as the headless commerce engine
- Custom platform experiences through Next.js application shells
- Service-oriented monorepo with API gateway boundaries
- Tenant-first infrastructure and package contracts
- Realtime-ready and AI-orchestration-ready service slots

## Top-Level Structure

```text
commerce-os-v2/
  apps/
  services/
  packages/
  infra/
  docs/
```

## Foundation Services

- PostgreSQL: platform control, Medusa, Odoo, and future tenant-isolated persistence
- Redis: cache, session, event bus, queues, and realtime coordination
- Meilisearch: search infrastructure
- MinIO: object storage for platform assets, ERP documents, imports, and audit exports
- Odoo: ERP engine only, with accounting/localization modules configured as required
- MedusaJS: headless commerce engine with admin UI disabled by default

## First Commands

```bash
pnpm install
pnpm typecheck
pnpm docker:config
pnpm docker:up
pnpm health:infra
```

The Docker command uses `infra/env/local.example.env` for local foundation validation. Create a private `.env` file before using real credentials.

## Non-Goals At This Stage

- No marketplace pages
- No ecommerce UI
- No admin CRUD
- No Odoo UI exposure to platform users
- No demo products or fake analytics
- No monolithic Laravel structure
