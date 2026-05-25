param(
  [string]$EnvFile = "./infra/env/local.example.env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Environment file not found: $EnvFile"
}

$requiredKeys = @(
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "GATEWAY_DB_NAME",
  "MEDUSA_DB_NAME",
  "ODOO_DB_NAME",
  "REDIS_PORT",
  "MEILI_MASTER_KEY",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
  "ODOO_IMAGE",
  "ODOO_INIT_MODULES",
  "MEDUSA_JWT_SECRET",
  "MEDUSA_COOKIE_SECRET",
  "GATEWAY_PORT",
  "REALTIME_PORT",
  "AI_ENGINE_PORT",
  "NOTIFICATION_ENGINE_PORT"
)

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0 -or $line.StartsWith("#")) {
    return
  }

  $parts = $line -split "=", 2
  if ($parts.Length -eq 2) {
    $values[$parts[0]] = $parts[1]
  }
}

$missing = @()
foreach ($key in $requiredKeys) {
  if (-not $values.ContainsKey($key) -or [string]::IsNullOrWhiteSpace([string]$values[$key])) {
    $missing += $key
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing required foundation env keys:"
  foreach ($key in $missing) {
    Write-Host "- $key"
  }
  exit 1
}

$requiredOdooModules = @(
  "account",
  "account_accountant",
  "sale_management",
  "purchase",
  "stock",
  "crm",
  "hr",
  "mrp",
  "point_of_sale",
  "website_sale",
  "l10n_tr"
)

$configuredModules = ([string]$values["ODOO_INIT_MODULES"]).Split(",", [System.StringSplitOptions]::RemoveEmptyEntries)
$missingModules = @()
foreach ($module in $requiredOdooModules) {
  if ($configuredModules -notcontains $module) {
    $missingModules += $module
  }
}

if ($missingModules.Count -gt 0) {
  Write-Host "Missing required Odoo modules:"
  foreach ($module in $missingModules) {
    Write-Host "- $module"
  }
  exit 1
}

Write-Host "Foundation environment validation passed."

$enterpriseAccountantPath = Join-Path (Get-Location) "services/odoo/addons/enterprise/account_accountant"
if (($configuredModules -contains "account_accountant") -and -not (Test-Path -LiteralPath $enterpriseAccountantPath)) {
  Write-Host "Warning: account_accountant is configured, but Odoo Enterprise addon path was not found:"
  Write-Host "- $enterpriseAccountantPath"
  Write-Host "Mount licensed Odoo Enterprise addons before first Odoo database bootstrap."
}
