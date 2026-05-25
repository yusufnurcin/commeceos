#!/bin/sh
set -eu

check() {
  name="$1"
  url="$2"
  echo "[bootstrap] checking ${name}: ${url}"
  curl --fail --silent --show-error "$url" >/dev/null
}

check "gateway-api" "http://gateway-api:8080/health"
check "gateway-ready" "http://gateway-api:8080/ready"
check "realtime" "http://realtime:8091/health"
check "notification-engine" "http://notification-engine:8094/health"
check "ai-engine" "http://ai-engine:8093/health"

echo "[bootstrap] foundation runtime bootstrap completed idempotently"
