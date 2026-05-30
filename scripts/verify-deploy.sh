#!/usr/bin/env bash
#
# Generate the example model into the e2e SFDX project and run a check-only
# deploy (`sf project deploy start --dry-run`) against a target org. A check-only
# deploy confirms Salesforce accepts the generated metadata WITHOUT persisting
# it, so it is safe to run repeatedly and is the core of the CI deploy gate.
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

# Generating the whole examples directory merges every model file into one
# deployable model, so a single check-only deploy covers all of them.
rm -rf "$E2E/force-app"
(cd "$ROOT" && npx tsx src/index.ts generate examples -o "e2e/deploy/force-app/main/default")

status=0
(cd "$E2E" && sf project deploy start --dry-run --source-dir force-app --target-org "$ORG" --wait 30) || status=$?

rm -rf "$E2E/force-app"
if [[ "$status" -ne 0 ]]; then
  echo "deploy verification FAILED" >&2
  exit 1
fi
echo "deploy verification passed"
