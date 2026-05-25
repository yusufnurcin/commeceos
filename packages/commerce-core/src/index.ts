import type { TenantContext } from "@commerce-os/tenant-core";

export type CommerceEngine = "medusa";
export type ErpEngine = "odoo";
export type CommerceDomainBoundary =
  | "catalog"
  | "product"
  | "cart"
  | "checkout"
  | "order"
  | "return"
  | "customer"
  | "inventory"
  | "pricing"
  | "promotion"
  | "region"
  | "tax"
  | "payment"
  | "fulfillment";
export type CommerceSourceOfTruth = "medusa" | "odoo" | "gateway";
export type OdooBridgeOperation =
  | "product-sync"
  | "inventory-sync"
  | "warehouse-sync"
  | "accounting-sync"
  | "invoice-sync"
  | "procurement-sync"
  | "hr-sync"
  | "crm-sync"
  | "pos-sync"
  | "shipment-sync";
export type MedusaOrchestrationOperation =
  | "catalog-orchestration"
  | "pricing-orchestration"
  | "checkout-orchestration"
  | "cart-orchestration"
  | "order-orchestration"
  | "return-orchestration"
  | "promotion-orchestration"
  | "region-orchestration"
  | "tax-orchestration";

export interface CommerceCommandEnvelope<TPayload = unknown> {
  readonly commandId: string;
  readonly tenant: TenantContext;
  readonly sourceWorkspace: string;
  readonly payload: TPayload;
  readonly requestedAt: string;
}

export interface EngineBoundary {
  readonly commerceEngine: CommerceEngine;
  readonly erpEngine: ErpEngine;
  readonly apiGatewayRequired: true;
}

export interface CommerceDomainContract {
  readonly boundary: CommerceDomainBoundary;
  readonly sourceOfTruth: CommerceSourceOfTruth;
  readonly tenantScoped: true;
  readonly directErpUiAllowed: false;
  readonly directMedusaAdminAllowed: false;
}

export interface MultiTenantCommerceContract {
  readonly tenant: TenantContext;
  readonly domains: readonly CommerceDomainContract[];
  readonly apiIngress: "gateway-api";
  readonly commerceEngine: "medusa";
  readonly erpEngine: "odoo";
}

export interface OdooBridgeOperationContract {
  readonly operation: OdooBridgeOperation;
  readonly engine: "odoo";
  readonly tenantScoped: true;
  readonly companyScoped: true;
  readonly eventDriven: true;
  readonly idempotencyRequired: true;
  readonly rawOdooUiAllowed: false;
  readonly auditRequired: true;
}

export interface OdooBridgeCoreContract {
  readonly bridgeName: "odoo-engine-bridge";
  readonly engine: "odoo";
  readonly rawOdooUiAllowed: false;
  readonly gatewayOnlyIngress: true;
  readonly operations: readonly OdooBridgeOperationContract[];
}

export interface MedusaOrchestrationContract {
  readonly operation: MedusaOrchestrationOperation;
  readonly engine: "medusa";
  readonly tenantScoped: true;
  readonly eventDriven: true;
  readonly idempotencyRequired: true;
  readonly adminUiAllowed: false;
  readonly auditRequired: true;
}

export interface MedusaCommerceCoreContract {
  readonly bridgeName: "medusa-commerce-orchestrator";
  readonly engine: "medusa";
  readonly adminUiAllowed: false;
  readonly gatewayOnlyIngress: true;
  readonly operations: readonly MedusaOrchestrationContract[];
}

export const defaultCommerceDomainBoundaries: readonly CommerceDomainContract[] = [
  {
    boundary: "catalog",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "product",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "cart",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "checkout",
    sourceOfTruth: "gateway",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "order",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "return",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "customer",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "inventory",
    sourceOfTruth: "odoo",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "pricing",
    sourceOfTruth: "gateway",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "promotion",
    sourceOfTruth: "gateway",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "region",
    sourceOfTruth: "medusa",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "tax",
    sourceOfTruth: "gateway",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "payment",
    sourceOfTruth: "gateway",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  },
  {
    boundary: "fulfillment",
    sourceOfTruth: "odoo",
    tenantScoped: true,
    directErpUiAllowed: false,
    directMedusaAdminAllowed: false
  }
];

const odooBridgeOperationNames: readonly OdooBridgeOperation[] = [
  "product-sync",
  "inventory-sync",
  "warehouse-sync",
  "accounting-sync",
  "invoice-sync",
  "procurement-sync",
  "hr-sync",
  "crm-sync",
  "pos-sync",
  "shipment-sync"
];

export const odooBridgeOperations: readonly OdooBridgeOperationContract[] = odooBridgeOperationNames.map((operation) => ({
  operation,
  engine: "odoo",
  tenantScoped: true,
  companyScoped: true,
  eventDriven: true,
  idempotencyRequired: true,
  rawOdooUiAllowed: false,
  auditRequired: true
}));

export const odooBridgeCoreContract: OdooBridgeCoreContract = {
  bridgeName: "odoo-engine-bridge",
  engine: "odoo",
  rawOdooUiAllowed: false,
  gatewayOnlyIngress: true,
  operations: odooBridgeOperations
};

const medusaOrchestrationOperationNames: readonly MedusaOrchestrationOperation[] = [
  "catalog-orchestration",
  "pricing-orchestration",
  "checkout-orchestration",
  "cart-orchestration",
  "order-orchestration",
  "return-orchestration",
  "promotion-orchestration",
  "region-orchestration",
  "tax-orchestration"
];

export const medusaOrchestrationOperations: readonly MedusaOrchestrationContract[] = medusaOrchestrationOperationNames.map((operation) => ({
  operation,
  engine: "medusa",
  tenantScoped: true,
  eventDriven: true,
  idempotencyRequired: true,
  adminUiAllowed: false,
  auditRequired: true
}));

export const medusaCommerceCoreContract: MedusaCommerceCoreContract = {
  bridgeName: "medusa-commerce-orchestrator",
  engine: "medusa",
  adminUiAllowed: false,
  gatewayOnlyIngress: true,
  operations: medusaOrchestrationOperations
};
