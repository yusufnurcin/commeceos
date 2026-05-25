# Workspace Package Strategy

This monorepo uses pnpm workspaces and Turborepo.

## Workspace Groups

- `apps/*`: runtime entrypoints and user-facing experience shells
- `services/*`: platform service runtimes and engine integrations
- `packages/*`: shared contracts, primitives, and platform-neutral utilities

## Package Rules

- Packages must not import from apps.
- Packages must not mount API routes.
- Packages must not connect directly to databases.
- Experience apps must not import service internals.
- Engine-specific details belong in services, not UI packages.
- Tenant, auth, sync, commerce, analytics, and UI contracts are split intentionally.

## Current Packages

- `@commerce-os/ui-system`: shadcn-compatible tokens and utility primitives
- `@commerce-os/auth-core`: identity/session contracts
- `@commerce-os/tenant-core`: tenant and workspace context contracts
- `@commerce-os/commerce-core`: Medusa/Odoo boundary envelopes
- `@commerce-os/analytics-core`: analytics envelope contracts only
- `@commerce-os/sync-core`: sync job and checkpoint contracts

## Build Strategy

`turbo.json` defines `build`, `dev`, `lint`, `typecheck`, and `test` tasks. The current foundation prioritizes type boundaries and service liveness before business modules are added.
