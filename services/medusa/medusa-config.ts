import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV ?? "development", process.cwd());

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://commerce_os:commerce_os_dev_password@localhost:5432/commerce_os_medusa?ssl_mode=disable";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const isMigrationMode = process.env.MEDUSA_MIGRATION_MODE === "true";

const runtimeModules = isMigrationMode
  ? []
  : [
      {
        resolve: "@medusajs/medusa/caching",
        options: {
          providers: [
            {
              resolve: "@medusajs/caching-redis",
              id: "caching-redis",
              is_default: true,
              options: {
                redisUrl: process.env.CACHE_REDIS_URL ?? redisUrl
              }
            }
          ]
        }
      },
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: {
          redisUrl
        }
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: {
          redis: {
            redisUrl
          }
        }
      },
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: {
                redisUrl: process.env.LOCKING_REDIS_URL ?? redisUrl
              }
            }
          ]
        }
      }
    ];

export default defineConfig({
  admin: {
    disable: process.env.MEDUSA_ADMIN_DISABLED !== "false"
  },
  projectConfig: {
    databaseUrl,
    databaseDriverOptions: {
      connection: {
        ssl: false
      }
    },
    redisUrl,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3004",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:3001",
      authCors:
        process.env.AUTH_CORS ??
        "http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:3005",
      jwtSecret: process.env.JWT_SECRET ?? "commerce_os_medusa_jwt_dev_secret",
      cookieSecret: process.env.COOKIE_SECRET ?? "commerce_os_medusa_cookie_dev_secret"
    }
  },
  modules: runtimeModules
});
