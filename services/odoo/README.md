# Odoo ERP Engine

Odoo is a mandatory backend ERP engine in this architecture.

It is not a user-facing platform UI and must not be exposed as the seller, tenant, courier, storefront, or central-admin experience. Platform users should interact with custom experience apps through the API gateway and orchestration layer.

## Required Initial Modules

The required module list is stored in `config/required-modules.txt` and wired into Docker through `ODOO_INIT_MODULES`.

`account_accountant` requires Odoo Enterprise addons. Mount Enterprise addons into `services/odoo/addons/enterprise` before bootstrapping a database that must install that module.

The foundation must not fake this module. If the licensed addon is absent, keep the missing module visible in validation output and mount the real Enterprise addon pack before production accounting rollout.

## Addon Paths

- `/usr/lib/python3/dist-packages/odoo/addons`: Odoo base addons
- `/mnt/enterprise-addons`: Odoo Enterprise addons
- `/mnt/custom-addons`: platform-owned Odoo bridge addons
- `/mnt/localization-packs`: future country localization packs
