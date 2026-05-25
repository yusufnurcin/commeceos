# Service Boundaries

## Odoo

Odoo owns ERP-grade workflows and records. It is internal to the platform and should be integrated through orchestration, not exposed as a raw UI.

## Medusa

Medusa owns headless commerce engine concerns. Its admin UI is disabled by default because platform experiences are custom-built.

## Gateway API

The gateway is the platform ingress for custom experiences. It will own tenant resolution, authentication enforcement, policy checks, routing, and orchestration.

## Search

The search service is reserved for index orchestration over Meilisearch. It must not become the source of truth for commerce or ERP data.

## Realtime

The realtime service is reserved for tenant-scoped channels and event fanout. It must not own durable domain state.

## Notification Engine

The notification engine is reserved for delivery orchestration. It must not directly own order, invoice, customer, or tenant records.

## AI Engine

The AI engine is reserved for future orchestration, planning, copilots, workflow assistance, and policy-mediated tool use. It must operate through platform contracts, not direct uncontrolled access to ERP records.
