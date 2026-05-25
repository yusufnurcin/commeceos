# Tenant Isolation Report

Tenant isolation is prepared at contract and runtime boundary level.

## Current Foundation

- Tenant header: `x-commerce-tenant`
- Workspace header: `x-commerce-workspace`
- Runtime tenant contract: `@commerce-os/tenant-core`
- Supported isolation modes:
  - `database-per-tenant`
  - `schema-per-tenant`
  - `row-level-security`
- PostgreSQL control schemas:
  - `platform_control`
  - `tenant_registry`
  - `tenant_isolation`

## ERP Isolation Plan

Each tenant must map to:

- Odoo database
- one or more Odoo company IDs
- country code
- localization pack
- fiscal localization profile
- default currency
- chart of accounts
- warehouse scope

## Storage/Search Isolation Plan

Each tenant must use deterministic prefixes:

- PostgreSQL database/schema
- Redis key prefix
- MinIO bucket or object prefix
- Meilisearch index prefix

No tenant demo records are created in this phase.
