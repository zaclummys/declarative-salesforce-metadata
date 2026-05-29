# e2e/deploy — deploy verification

An isolated Salesforce DX project used only to verify that the metadata `dsfm`
generates is actually **accepted by Salesforce**. It is not part of the CLI; the
repo root remains a plain Node project.

`force-app/` here is generated output (gitignored). `sourceApiVersion` in
`sfdx-project.json` pins the API version the generated source is validated against.

## How verification works

For each example model, [`scripts/verify-deploy.sh`](../../scripts/verify-deploy.sh):

1. generates it into `e2e/deploy/force-app/main/default`, then
2. runs a **check-only** deploy (`sf project deploy validate`) against a target org.

A check-only deploy confirms Salesforce accepts the metadata **without persisting
it**, so it is safe to run repeatedly (including against a shared org) and is the
core of the CI deploy gate.

## Run locally

Requires the Salesforce CLI (`sf`) authenticated to an org:

```sh
# against an existing org alias
npm run verify:deploy -- my-org-alias

# or create a throwaway scratch org first (needs a Dev Hub)
sf org create scratch --definition-file e2e/deploy/config/project-scratch-def.json \
  --alias dsfm-e2e --set-default --duration-days 1
npm run verify:deploy -- dsfm-e2e
sf org delete scratch --target-org dsfm-e2e --no-prompt
```

CI runs the same script — see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).
