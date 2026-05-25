SELECT 'CREATE DATABASE commerce_os_gateway'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'commerce_os_gateway')\gexec

SELECT 'CREATE DATABASE commerce_os_medusa'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'commerce_os_medusa')\gexec

SELECT 'CREATE DATABASE commerce_os_odoo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'commerce_os_odoo')\gexec

\connect commerce_os_gateway

CREATE SCHEMA IF NOT EXISTS platform_control;
CREATE SCHEMA IF NOT EXISTS tenant_registry;
CREATE SCHEMA IF NOT EXISTS tenant_isolation;
