import {
  AUTHORIZATION_HEADER,
  SERVICE_TOKEN_HEADER,
  SESSION_COOKIE_NAME,
  type AccessPolicyContract,
  type HybridAuthBoundary
} from "@commerce-os/auth-core";
import { TENANT_HEADER, WORKSPACE_HEADER } from "@commerce-os/tenant-core";

export const hybridAuthBoundary: HybridAuthBoundary = {
  acceptedMechanisms: ["jwt", "session", "service-token"],
  jwtHeader: AUTHORIZATION_HEADER,
  sessionCookie: SESSION_COOKIE_NAME,
  serviceTokenHeader: SERVICE_TOKEN_HEADER,
  rawOdooSessionAccepted: false
};

export const foundationAccessPolicy: AccessPolicyContract = {
  policyId: "foundation-runtime-access-policy",
  roles: [
    {
      roleId: "platform-operator",
      roleName: "Platform Operator",
      scope: "platform",
      tenantBound: false,
      workspaceBound: true
    },
    {
      roleId: "tenant-admin",
      roleName: "Tenant Admin",
      scope: "tenant",
      tenantBound: true,
      workspaceBound: true
    },
    {
      roleId: "workspace-operator",
      roleName: "Workspace Operator",
      scope: "workspace",
      tenantBound: true,
      workspaceBound: true
    },
    {
      roleId: "service-account",
      roleName: "Service Account",
      scope: "platform",
      tenantBound: false,
      workspaceBound: false
    }
  ],
  permissions: [
    {
      permissionId: "runtime.health.read",
      resource: "runtime.health",
      action: "read",
      scope: "platform",
      effect: "allow"
    },
    {
      permissionId: "tenant.context.resolve",
      resource: "tenant.context",
      action: "resolve",
      scope: "tenant",
      effect: "allow"
    },
    {
      permissionId: "erp.bridge.invoke",
      resource: "erp.bridge",
      action: "invoke",
      scope: "erp",
      effect: "allow"
    },
    {
      permissionId: "event.contract.read",
      resource: "event.contract",
      action: "read",
      scope: "sync",
      effect: "allow"
    },
    {
      permissionId: "commerce.orchestration.invoke",
      resource: "commerce.orchestration",
      action: "invoke",
      scope: "commerce",
      effect: "allow"
    },
    {
      permissionId: "audit.center.read",
      resource: "audit.center",
      action: "read",
      scope: "audit",
      effect: "allow"
    }
  ],
  abacConstraints: [
    {
      attribute: TENANT_HEADER,
      operator: "equals",
      valueSource: "tenant"
    },
    {
      attribute: WORKSPACE_HEADER,
      operator: "equals",
      valueSource: "workspace"
    }
  ]
};
