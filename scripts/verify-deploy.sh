#!/usr/bin/env bash
#
# Generate each example model into the e2e SFDX project and run a check-only
# ("validate") deploy against a target org. A check-only deploy confirms that
# Salesforce accepts the generated metadata WITHOUT persisting it, so it is safe
# to run repeatedly and is the core of the CI deploy gate.
#
# Usage: scripts/verify-deploy.sh <target-org-alias-or-username>
#    or: SF_TARGET_ORG=<alias> scripts/verify-deploy.sh
#
set -euo pipefail

ORG="${1:-${SF_TARGET_ORG:-}}"
if [[ -z "$ORG" ]]; then
  echo "usage: verify-deploy.sh <target-org-alias-or-username> (or set SF_TARGET_ORG)" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
E2E="$ROOT/e2e/deploy"
OUT="$E2E/force-app/main/default"

# Examples to verify: the objects/ directory layout plus each single-file model.
TARGETS=("examples")
for f in "$ROOT"/examples/*.yaml; do
  TARGETS+=("examples/$(basename "$f")")
done

fail=0
for target in "${TARGETS[@]}"; do
  echo "==> verifying $target"
  rm -rf "$E2E/force-app"
  (cd "$ROOT" && npx tsx src/index.ts generate "$target" -o "e2e/deploy/force-app/main/default")
  if ! (cd "$E2E" && sf project deploy validate --source-dir force-app --target-org "$ORG" --wait 20); then
    echo "FAILED: $target" >&2
    fail=1
  fi
done

rm -rf "$E2E/force-app"
if [[ "$fail" -ne 0 ]]; then
  echo "deploy verification FAILED" >&2
  exit 1
fi
echo "deploy verification passed"
