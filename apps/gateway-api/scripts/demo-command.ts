export {};

const action = process.argv[2] ?? "status";
const allowedActions = new Set(["status", "seed", "cleanup"]);

if (!allowedActions.has(action)) {
  console.error("Usage: pnpm demo:status | pnpm demo:seed | pnpm demo:cleanup");
  process.exit(1);
}

const gatewayUrl = (process.env.DEMO_GATEWAY_URL ?? "http://localhost:8088").replace(/\/$/, "");
const tenantId = process.env.CENTRAL_ADMIN_TENANT_ID ?? "platform";
const workspaceId = process.env.CENTRAL_ADMIN_WORKSPACE_ID ?? "central-admin";
const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@commerceos.local";
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "CommerceOS@2026!";

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

const login = await fetch(`${gatewayUrl}/v1/auth/login`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-commerce-tenant": tenantId,
    "x-commerce-workspace": workspaceId
  },
  body: JSON.stringify({ email, password })
});
const loginPayload = await readJson(login);
if (!login.ok || typeof loginPayload.accessToken !== "string") {
  console.error(JSON.stringify({ status: "demo_command_login_failed", gatewayUrl, response: loginPayload }, null, 2));
  process.exit(1);
}

const response = await fetch(`${gatewayUrl}/v1/demo/${action}`, {
  method: action === "status" ? "GET" : "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${loginPayload.accessToken}`,
    "x-commerce-tenant": tenantId,
    "x-commerce-workspace": workspaceId
  }
});
const payload = await readJson(response);
console.log(JSON.stringify(payload, null, 2));
if (!response.ok) {
  process.exitCode = 1;
}
