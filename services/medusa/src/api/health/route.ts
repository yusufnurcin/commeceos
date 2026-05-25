import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { medusaCommerceCoreContract } from "@commerce-os/commerce-core";

export async function GET(_request: MedusaRequest, response: MedusaResponse) {
  response.json({
    status: "ok",
    service: "medusa",
    layer: "headless-commerce-engine",
    adminUiDisabled: process.env.MEDUSA_ADMIN_DISABLED !== "false",
    businessSeedDataEnabled: false,
    apiOnly: true,
    tenantScopedContractsPrepared: true,
    adminIngressDisabled: true,
    orchestration: medusaCommerceCoreContract
  });
}
