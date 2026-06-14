#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GOAL="${1:-package}"

if command -v mvnw >/dev/null 2>&1; then
    MVN="./mvnw"
elif [ -x "./mvnw" ]; then
    MVN="./mvnw"
else
    MVN="mvn"
fi

exec $MVN -T 1C clean "$GOAL" -DskipTests
