---
sidebar_position: 4
---

# Deployment

`dsfm` is a **generator** — it produces Salesforce DX source that you deploy with
the Salesforce CLI.

```bash
dsfm generate model.yaml --out force-app/main/default
sf project deploy start --source-dir force-app/main/default
```

## Verifying that Salesforce accepts the output

Generated XML is only trustworthy if Salesforce actually accepts it. The project
ships a **check-only deploy** verification (`sf project deploy validate`), which
confirms acceptance **without persisting** anything — safe to run repeatedly,
including in CI.

```bash
npm run verify:deploy -- <org-alias>
```

This generates each example into an isolated SFDX project (`e2e/deploy/`, with a
pinned `sourceApiVersion`) and runs a check-only deploy against the target org.

## In CI

The GitHub Actions workflow runs build + tests on every push. The deploy
verification job runs only when an `SFDX_AUTH_URL` secret is configured: it spins
up a scratch org, verifies every example, and tears it down.

## Notes & limitations

- Deploys are **additive** by default — removing a field from the YAML does not
  delete it from the org. Destructive changes are not yet handled.
- There is no diff/plan step yet; the CLI emits source, and the Salesforce CLI
  performs the deploy.
