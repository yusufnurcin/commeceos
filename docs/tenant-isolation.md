# Tenant Isolation Strategy

Tenant isolation is a first-class architectural concern.

## Supported Isolation Modes

The foundation package `@commerce-os/tenant-core` defines:

- `database-per-tenant`
- `schema-per-tenant`
- `row-level-security`

The default production direction should be database-per-tenant or schema-per-tenant for regulated commerce and accounting workloads. Row-level security can be used for lower-risk shared control-plane data, but should not be the only isolation model for ERP-grade financial records.

## Control Plane

The PostgreSQL bootstrap creates schemas for:

- `platform_control`
- `tenant_registry`
- `tenant_isolation`

These schemas are intentionally empty at this stage. They are reserved for future provisioning metadata, not demo tenants.

## Request Boundary

Tenant context must enter the platform through:

- `x-commerce-tenant`
- `x-commerce-workspace`
- authenticated principal context
- hostname or workspace resolution

Experience apps should never infer tenant database access locally. The gateway resolves tenant context and passes it to downstream services.

## ERP Mapping

Each tenant can map to one or more Odoo companies. The tenant registry must eventually track:

- Odoo database or company identifier
- country localization pack
- default currency
- tax/fiscal profile
- enabled ERP modules
- warehouse and procurement scope

No tenant provisioning automation is implemented yet.
