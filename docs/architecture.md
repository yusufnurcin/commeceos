# Architecture Foundation

Commerce OS v2 is a multi-tenant commerce operating system foundation, not a conventional ecommerce web application.

## Layers

1. Experience apps in `apps/*`
   - Custom platform surfaces only
   - No raw ERP UI
   - No direct database coupling
   - No direct Odoo or Medusa admin exposure

2. API gateway in `apps/gateway-api`
   - Planned single ingress for experience apps
   - Tenant and workspace context enforcement
   - Service orchestration boundary
   - Future policy, rate limit, audit, and AI routing boundary

3. Domain services in `services/*`
   - `medusa`: optional commerce provider / bridge engine
   - `odoo`: backend ERP engine
   - `realtime`: future event delivery foundation
   - `search`: future search orchestration foundation
   - `ai-engine`: future AI orchestration foundation
   - `notification-engine`: future notification orchestration foundation

4. Shared packages in `packages/*`
   - Cross-service contracts and primitives
   - No tenant data persistence
   - No storefront or admin business behavior

5. Infrastructure in `infra/*`
   - Docker, network, PostgreSQL, Redis, Meilisearch, MinIO, and healthchecks

## Hard Boundaries

- Storefront and ERP UI are never mixed.
- Odoo remains an internal ERP engine.
- Medusa admin UI is disabled by default.
- Experience apps communicate through the gateway, not directly to engine internals.
- Shared packages export contracts and technical primitives, not application screens.

## Runtime Direction

The foundation is designed to grow into a service-oriented platform:

- tenant-aware API contracts
- workspace-scoped UX
- engine adapters for Medusa and Odoo
- async sync flows
- realtime channel delivery
- search indexing pipelines
- AI orchestration and policy controls
