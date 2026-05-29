# e2e

End-to-end checks for the CLI. Two independent concerns:

- **`cli/`** — CLI end-to-end tests (vitest). They run `dsfm` as a subprocess and
  assert on the generated files on disk (filesystem checks). No Salesforce org
  required; run with `npm run test:e2e`.
- **`deploy/`** — an isolated Salesforce DX project for verifying that generated
  metadata is *accepted by Salesforce* via a check-only deploy. Requires an org;
  see [`deploy/README.md`](deploy/README.md).
