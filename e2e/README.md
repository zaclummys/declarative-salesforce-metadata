# e2e

End-to-end checks for the CLI.

- **`cli/`** — CLI end-to-end tests (vitest). They run `dsfm` as a subprocess and
  assert on the generated files on disk (filesystem checks). No Salesforce org
  required; run with `npm run test:e2e`.

## Deploy verification

[`scripts/verify-deploy.sh`](../scripts/verify-deploy.sh) confirms generated
metadata is *accepted by Salesforce* via a check-only deploy. It scaffolds a
throwaway SFDX project with `sf project generate` (nothing Salesforce-specific is
committed here), generates the whole `examples/` model into it, and runs
`sf project deploy start --dry-run`.

Requires the Salesforce CLI (`sf`) authenticated to an org:

```sh
npm run verify:deploy -- my-org-alias
```

CI runs the same script — see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
It is gated on an `SFDX_AUTH_URL` secret and skipped when absent.
