#!/usr/bin/env bash
#
# Generate the example model into a throwaway SFDX project and run a check-only
# deploy (`sf project deploy start --dry-run`) against a target org. A check-only
# deploy confirms Salesforce accepts the generated metadata WITHOUT persisting
# it, so it is safe to run repeatedly and is the core of the CI deploy gate.
#
# The SFDX project is created on the fly with `sf project generate`, so nothing
# Salesforce-specific is committed to this repo.
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

# Pinned API version the generated metadata is validated against.
API_VERSION="62.0"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Scaffold an empty SFDX project (just sfdx-project.json + force-app).
sf project generate --name proj --template empty --output-dir "$WORK" --api-version "$API_VERSION"
PROJECT="$WORK/proj"

# Generating the whole examples directory merges every model file into one
# deployable model, so a single check-only deploy covers all of them.
(cd "$ROOT" && npx tsx src/index.ts generate examples -o "$PROJECT/force-app/main/default")

status=0
(cd "$PROJECT" && sf project deploy start --dry-run --source-dir force-app --target-org "$ORG" --wait 30) || status=$?

if [[ "$status" -ne 0 ]]; then
  echo "deploy verification FAILED" >&2
  exit 1
fi
echo "deploy verification passed"
