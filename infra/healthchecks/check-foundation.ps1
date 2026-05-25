$ErrorActionPreference = "Stop"

$targets = @(
  @{ Name = "Gateway API"; Url = "http://127.0.0.1:8088/health"; Type = "http" },
  @{ Name = "Gateway Ready"; Url = "http://127.0.0.1:8088/ready"; Type = "http" },
  @{ Name = "Runtime Health Matrix"; Url = "http://127.0.0.1:8088/runtime/health-matrix"; Type = "http" }
)

$failures = New-Object System.Collections.Generic.List[string]

foreach ($target in $targets) {
  try {
    if ($target.Type -eq "tcp") {
      $client = New-Object System.Net.Sockets.TcpClient
      $task = $client.ConnectAsync($target.Host, [int]$target.Port)
      if (-not $task.Wait(3000)) {
        throw "TCP timeout"
      }
      $client.Dispose()
    }

    if ($target.Type -eq "http") {
      $response = Invoke-WebRequest -Uri $target.Url -Method Get -TimeoutSec 5
      if ($response.StatusCode -lt 200 -or $response.StatusCode -gt 299) {
        throw "HTTP $($response.StatusCode)"
      }
    }

    Write-Host "[ok] $($target.Name)"
  }
  catch {
    $failures.Add("$($target.Name): $($_.Exception.Message)") | Out-Null
    Write-Host "[fail] $($target.Name)"
  }
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Foundation healthcheck failures:"
  foreach ($failure in $failures) {
    Write-Host "- $failure"
  }
  exit 1
}

Write-Host ""
Write-Host "Foundation healthchecks passed."
