# Odoo ERP Engine Strategy

Odoo is mandatory and mission critical in Commerce OS v2.

It is the backend ERP engine for accounting, operations, localization, warehouse, procurement, HR, manufacturing, CRM, point of sale, and financial reporting. It is not the end-user platform UI.

## Required Initial Modules

The Docker foundation wires this module list into `ODOO_INIT_MODULES`:

- `account`
- `account_accountant`
- `sale_management`
- `purchase`
- `stock`
- `crm`
- `hr`
- `mrp`
- `point_of_sale`
- `website_sale`
- `l10n_tr`

`account_accountant` depends on Odoo Enterprise addons. A production bootstrap must mount licensed Enterprise addons into `services/odoo/addons/enterprise` before initializing the Odoo database.

Do not replace this with a placeholder addon. Accounting is mission critical, so the runtime must either load the licensed module or explicitly report that the Enterprise addon pack is not mounted.

## Global Accounting Requirements

The ERP boundary must support:

- multi-country accounting
- country-specific tax systems
- multi-company accounting
- multi-currency accounting
- invoice workflows
- warehouse management
- procurement
- CRM
- HR
- manufacturing
- financial reporting
- localization modules

## Platform Rule

Odoo records and workflows can be orchestrated by platform services, but raw Odoo UI should not be exposed to central admins, sellers, tenants, couriers, or storefront users.

Custom platform experiences must be built in `apps/*` and integrated through the gateway and service orchestration layer.

## Localization Expansion

Future country packs should live under `services/odoo/localization-packs` or be delivered as versioned Odoo addon bundles. The tenant registry must map tenants to country, currency, company, chart-of-accounts, fiscal position, tax, and reporting rules before business workflows are enabled.
