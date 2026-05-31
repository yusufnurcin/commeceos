export interface GatewayEnvironment {
  readonly port: number;
  readonly nodeEnv: string;
  readonly gatewayUrl: string;
  readonly platformPostgresUrl: string;
  readonly redisUrl: string;
  readonly postgresHost: string;
  readonly postgresPort: number;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly minioUrl: string;
  readonly meiliUrl: string;
  readonly medusaUrl: string;
  readonly odooHost: string;
  readonly odooPort: number;
  readonly realtimeUrl: string;
  readonly searchUrl: string;
  readonly notificationUrl: string;
  readonly aiEngineUrl: string;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMaxRequests: number;
  readonly authJwtIssuer: string;
  readonly authJwtAudience: string;
  readonly authJwtSecret: string;
  readonly gatewayServiceToken: string;
  readonly secureCookieDomain: string;
  readonly integrationVaultSecret: string | undefined;
  readonly demoModeEnabled: boolean;
}

export function readGatewayEnvironment(env: NodeJS.ProcessEnv = process.env): GatewayEnvironment {
  const gatewayEnvironment = {
    port: Number(env.PORT ?? 8080),
    nodeEnv: env.NODE_ENV ?? "development",
    gatewayUrl: env.GATEWAY_URL ?? "http://localhost:8080",
    platformPostgresUrl:
      env.PLATFORM_POSTGRES_URL ?? "postgres://commerce_os:commerce_os_dev_password@localhost:5432/commerce_os_gateway",
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    postgresHost: env.POSTGRES_HOST ?? "localhost",
    postgresPort: Number(env.POSTGRES_PORT_INTERNAL ?? 5432),
    redisHost: env.REDIS_HOST ?? "localhost",
    redisPort: Number(env.REDIS_PORT_INTERNAL ?? 6379),
    minioUrl: env.MINIO_URL ?? "http://localhost:9002",
    meiliUrl: env.MEILI_URL ?? "http://localhost:7700",
    medusaUrl: env.MEDUSA_URL ?? "http://localhost:9000",
    odooHost: env.ODOO_HOST ?? "localhost",
    odooPort: Number(env.ODOO_PORT_INTERNAL ?? 8069),
    realtimeUrl: env.REALTIME_URL ?? "http://localhost:8091",
    searchUrl: env.SEARCH_URL ?? "http://localhost:8092",
    notificationUrl: env.NOTIFICATION_URL ?? "http://localhost:8094",
    aiEngineUrl: env.AI_ENGINE_URL ?? "http://localhost:8093",
    rateLimitWindowMs: Number(env.GATEWAY_RATE_LIMIT_WINDOW_MS ?? 60000),
    rateLimitMaxRequests: Number(env.GATEWAY_RATE_LIMIT_MAX_REQUESTS ?? 120),
    authJwtIssuer: env.AUTH_JWT_ISSUER ?? "commerce-os-gateway",
    authJwtAudience: env.AUTH_JWT_AUDIENCE ?? "commerce-os-workspaces",
    authJwtSecret: env.AUTH_JWT_SECRET ?? "commerce_os_gateway_jwt_dev_secret_change_before_prod",
    gatewayServiceToken: env.GATEWAY_SERVICE_TOKEN ?? "commerce_os_gateway_service_dev_token",
    secureCookieDomain: env.SECURE_COOKIE_DOMAIN ?? "localhost",
    integrationVaultSecret: env.INTEGRATION_VAULT_SECRET ?? env.APP_SECRET,
    demoModeEnabled: env.DEMO_MODE_ENABLED === "true"
  };

  const invalidNumberKeys = [
    ["PORT", gatewayEnvironment.port],
    ["POSTGRES_PORT_INTERNAL", gatewayEnvironment.postgresPort],
    ["REDIS_PORT_INTERNAL", gatewayEnvironment.redisPort],
    ["ODOO_PORT_INTERNAL", gatewayEnvironment.odooPort],
    ["GATEWAY_RATE_LIMIT_WINDOW_MS", gatewayEnvironment.rateLimitWindowMs],
    ["GATEWAY_RATE_LIMIT_MAX_REQUESTS", gatewayEnvironment.rateLimitMaxRequests]
  ] as const;

  for (const [key, value] of invalidNumberKeys) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid numeric environment value: ${key}`);
    }
  }

  if (gatewayEnvironment.nodeEnv === "production") {
    const insecureDefaults = [
      ["AUTH_JWT_SECRET", gatewayEnvironment.authJwtSecret, "commerce_os_gateway_jwt_dev_secret_change_before_prod"],
      ["GATEWAY_SERVICE_TOKEN", gatewayEnvironment.gatewayServiceToken, "commerce_os_gateway_service_dev_token"],
      ["INTEGRATION_VAULT_SECRET", gatewayEnvironment.integrationVaultSecret, "commerce_os_integration_vault_dev_secret_change_before_prod"]
    ] as const;

    for (const [key, value, defaultValue] of insecureDefaults) {
      if (!value || value === defaultValue) {
        throw new Error(`Production requires a non-default secret: ${key}`);
      }
    }
  }

  return gatewayEnvironment;
}
