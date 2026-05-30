---
sidebar_position: 3
---

# CLI reference

The CLI is invoked as `dsfm` (or `npx tsx src/index.ts` in development).

## `dsfm validate <input>`

Parse and validate the model without writing output. Exits non-zero if there are
validation errors.

```bash
dsfm validate examples
```

## `dsfm generate <input> [options]`

Generate Salesforce source XML from the model.

| Option | Description |
|--------|-------------|
| `-o, --out <dir>` | Output source root. Defaults to `force-app/main/default`. |
| `-w, --watch` | Regenerate whenever the model changes. |

```bash
dsfm generate examples --out force-app/main/default
dsfm generate examples --watch
```

In watch mode the CLI never exits on a parse/validation error — it prints the
error and keeps watching, so you can fix the model and see the next run succeed.

## Input forms

`<input>` may be either:

- a **single YAML file** (a single-object file with `fullName`, or a multi-object
  file with an `objects:` map), or
- a **directory**, in which case all `.yaml`/`.yml` files under it (recursively)
  are loaded and merged into one model.

See [Data model](/model/data-model).

## Global flags

| Flag | Description |
|------|-------------|
| `--help` | Show usage (works per command too: `dsfm generate --help`). |
| `--version` | Print the CLI version. |
