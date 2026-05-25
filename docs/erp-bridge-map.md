# ERP Bridge Map

Odoo is the ERP engine only. It is not the central UI.

## Required Initial Modules

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

`account_accountant` requires licensed Odoo Enterprise addons mounted at:

```text
services/odoo/addons/enterprise
```

The foundation does not stub or fake `account_accountant`. If the licensed addon is not mounted, the Odoo engine still boots with the available required community modules and the environment validator reports the missing enterprise addon path.

## Addon Boundary

- Base addons: `/usr/lib/python3/dist-packages/odoo/addons`
- Enterprise addons: `/mnt/enterprise-addons`
- Platform-owned bridge addons: `/mnt/custom-addons`
- Country localization packs: `/mnt/localization-packs`

## Bridge Direction

Gateway and sync services may orchestrate Odoo through controlled bridge contracts. Platform users must never be redirected to raw Odoo admin UI as the product experience.
