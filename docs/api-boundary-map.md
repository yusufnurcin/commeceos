# API Boundary Map

## Gateway API

Gateway API is the only planned external ingress.

Current foundation endpoints:

- `GET /health`
- `GET /ready`
- `GET /runtime/health-matrix`
- `GET /runtime/service-discovery`
- `GET /runtime/security-boundaries`
- `GET /runtime/topology`
- `GET /v1/*` returns reserved boundary responses only

## Business API Rule

Future `/v1/*` routes must require:

- `Authorization: Bearer <jwt>` or `commerce_os_session`
- `x-commerce-service-token` for trusted service calls
- `x-commerce-tenant`
- `x-commerce-workspace`
- `x-correlation-id`
- idempotency key for mutating commands

## Engine Boundary Rule

- Raw Odoo UI is not an API surface for platform users.
- Medusa Admin UI remains disabled.
- Storefront, seller, tenant, courier, and central-admin experiences must call the gateway, not engine internals.
