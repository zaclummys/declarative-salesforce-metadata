# declarative-sf-metadata (`dsfm`)

Define Salesforce **custom objects** and **custom fields** declaratively in YAML,
and generate Salesforce DX source metadata from it.

See [SPEC.md](SPEC.md) for the full format and design rationale.

## Documentation site

A Docusaurus documentation site lives in [`website/`](website/):

```sh
cd website
npm install
npm start          # local dev server
npm run build      # static site into website/build
```

It deploys to GitHub Pages automatically via [`.github/workflows/docs.yml`](.github/workflows/docs.yml)
on pushes to `main`. Before the first deploy: set the `ORG`/`REPO` constants in
[`website/docusaurus.config.ts`](website/docusaurus.config.ts) and enable Pages
(Settings → Pages → Source: GitHub Actions).

## Install / build

```sh
npm install
npm run build      # compile TypeScript to dist/
```

During development you can run the CLI without building:

```sh
npm run dev -- <command> <args>
# or
npx tsx src/index.ts <command> <args>
```

## Usage

```sh
# Validate a model (no output written)
dsfm validate examples

# Generate Salesforce source XML
dsfm generate examples --out force-app/main/default

# Regenerate automatically while editing the model
dsfm generate examples --out force-app/main/default --watch

# Render the model as a Mermaid entity-relationship diagram
dsfm erd examples                          # Mermaid text to stdout
dsfm erd examples --out docs/model.mmd     # Mermaid text to a file
dsfm erd examples --out docs/model.svg     # rendered image (format from extension)
dsfm erd examples --out docs/model.png --format png

# Deploy the generated source with the Salesforce CLI
sf project deploy start --source-dir force-app/main/default
```

`<input>` may be either a directory containing `objects/*.yaml` (one object per
file) or a single YAML file with a top-level `objects:` map.

## Commands

| Command | Description |
|---------|-------------|
| `dsfm validate <input>` | Parse and validate the YAML model without writing output. Exits non-zero on errors. |
| `dsfm generate <input> [--out <dir>] [--watch]` | Generate Salesforce source XML from the model. `--out` defaults to `force-app/main/default`. `--watch` (`-w`) regenerates on every change. |
| `dsfm erd <input> [--out <file>] [--format <fmt>]` | Render the model as a [Mermaid](https://mermaid.js.org/) ER diagram. Lookups are dashed edges, master-detail solid. `--format` (`-f`) is `mmd` (text, default), `svg`, or `png` — inferred from the `--out` extension if omitted. `svg`/`png` are rendered via the public [mermaid.ink](https://mermaid.ink) service (needs network; sends object/field names to a third party) and require `--out`. |
| `dsfm --help` | Show usage. |
| `dsfm --version` | Print the CLI version. |

Run `dsfm <command> --help` for command-specific options.

## Model format (short version)

```yaml
fullName: Invoice__c
label: Invoice
pluralLabel: Invoices
nameField:
  fullName: Name
  label: Invoice Number
  type: AutoNumber
  displayFormat: INV-{0000}
fields:
  Amount__c:
    label: Amount
    type: Currency
    precision: 16
    scale: 2
    required: true
```

API names (`Invoice__c`, `Amount__c`) and labels are written explicitly — they
map 1:1 onto the Salesforce Metadata API. See [SPEC.md](SPEC.md) for the field
type catalog and per-type required keys.

## Pipeline

```
YAML  ->  parser  ->  in-memory model  ->  validator  ->  XML emitter  ->  force-app source
        (src/parser.ts)   (src/model.ts)  (src/validator.ts) (src/emitter.ts)
```

The front of the pipeline is output-agnostic, leaving room for a direct Metadata
API mode later.
