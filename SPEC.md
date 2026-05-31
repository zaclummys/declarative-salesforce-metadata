# declarative-sf-metadata — Spec

A CLI that lets you define Salesforce metadata declaratively in YAML. Scope of
this first version: **custom objects** and **custom fields** only.

## Design principles

1. **Explicit, 1:1 with Salesforce.** The user writes exact API names
   (`Invoice__c`, `Amount__c`) and labels by hand. No auto-suffixing, no label
   derivation. Every YAML key maps directly onto a Salesforce Metadata API
   concept, so there is no hidden translation layer.
2. **Minimal but not magic.** Sensible defaults for boilerplate
   (`deploymentStatus`, `sharingModel`) but nothing that changes API names.
3. **Block YAML only.** No inline flow maps (`{ ... }`) or flow sequences in
   authored files or examples — block style throughout for readable diffs.
4. **Type-driven validation.** A field's `type` determines which type-specific
   keys are valid/required. The tool validates before generating anything.
5. **Lean on official `@salesforce/*` packages.** Before building anything,
   review what the official packages already provide and reuse it rather than
   reinventing it — `@salesforce/types` for authoritative metadata shapes and
   enums, `@salesforce/source-deploy-retrieve` for source/deploy, `@salesforce/core`
   for auth. Revisit this periodically: these packages evolve, and new releases
   may subsume code we currently maintain by hand.

## File layout

A model is loaded from a path that is either a **single file** or a **directory**.
When a directory is given, **all** `.yaml`/`.yml` files under it (recursively) are
loaded and merged into one model. Each file may use either form below, and the two
may be mixed freely within a directory.

### Single-object file

```
Invoice__c.yaml
```

The object *is* the document; its API name comes from the top-level `fullName:`
key (not the filename), so renaming a file never changes the deployed API name.

### Multi-object file

```
model.yaml
```

A top-level `objects:` map keyed by API name. Here the map key *is* the API name,
so `fullName:` is omitted on each object.

### Directory

```
my-model/
  Invoice__c.yaml          # single-object file
  Account.yaml             # standard object: only adds custom fields
  relationships.yaml       # multi-object file (objects: map)
  subfolder/Order__c.yaml  # nested files are loaded too
```

All files are merged; duplicate object API names across files are a validation
error.

## Object schema

| Key                | Required | Notes                                              |
|--------------------|----------|----------------------------------------------------|
| `fullName`         | per-file only | Exact API name, e.g. `Invoice__c`. In single-file form this is the map key instead. |
| `label`            | yes      | Human label.                                       |
| `pluralLabel`      | yes      | Plural human label.                                |
| `description`      | no       |                                                    |
| `sharingModel`     | no       | Default `ReadWrite`.                               |
| `deploymentStatus` | no       | Default `Deployed`.                                |
| `nameField`        | yes (new objects) | The record Name column. See below.        |
| `fields`           | no       | Map of custom fields keyed by exact API name.      |

### nameField

```yaml
nameField:
  fullName: Name
  label: Invoice Number
  type: AutoNumber        # or Text
  displayFormat: INV-{0000}   # AutoNumber only
```

## Field schema

Fields are a **keyed map**: the key is the exact API name (e.g. `Amount__c`),
the value is the field definition. The map key prevents duplicate field names.

Common keys (all types):

| Key        | Notes                                   |
|------------|-----------------------------------------|
| `label`    | required                                |
| `type`     | required; see catalog below             |
| `required` | optional, default false                 |
| `description` | optional                             |
| `unique`   | optional (where the type allows it)     |

### Field type catalog (v1)

`Text`, `TextArea`, `LongTextArea`, `Number`, `Currency`, `Percent`,
`Checkbox`, `Date`, `DateTime`, `Email`, `Phone`, `Url`, `Picklist`,
`MultiselectPicklist`, `Lookup`, `MasterDetail`, `AutoNumber`.

> There is **no** `Formula` field type in Salesforce. A formula field is a
> field of its *return type* (`Text`, `Currency`, `Number`, ...) plus a
> `formula` attribute (and optional `formulaTreatBlanksAs`).

### Type-specific keys / validation rules

| Type(s)                         | Required keys                        | Optional keys             |
|---------------------------------|--------------------------------------|---------------------------|
| `Text`                          | `length`                             | `unique`, `caseSensitive` |
| `TextArea`                      | —                                    |                           |
| `LongTextArea`                  | `length`, `visibleLines`             |                           |
| `Number`, `Currency`, `Percent` | `precision`, `scale`                 | `unique` (Number)         |
| `Checkbox`                      | `defaultValue`                       |                           |
| `Date`, `DateTime`              | —                                    |                           |
| `Email`, `Phone`, `Url`         | —                                    | `unique` (Email)          |
| `Picklist`, `MultiselectPicklist` | `valueSet`                         |                           |
| `Lookup`                        | `referenceTo`, `relationshipName`    | `relationshipLabel`, `deleteConstraint` |
| `MasterDetail`                  | `referenceTo`, `relationshipName`    | `relationshipLabel`, `reparentableMasterDetail` |
| `AutoNumber`                    | `displayFormat`                      |                           |
| *(any type) formula field*      | `formula`                            | `formulaTreatBlanksAs`    |

### valueSet (picklists)

Authored with a friendly flattened form; the parser expands it into the official
`valueSet.valueSetDefinition.value[]` shape on the way to source XML.

```yaml
valueSet:
  restricted: true        # optional, defaults true
  values:
    - fullName: Draft
      label: Draft
      default: true
    - fullName: Sent
      label: Sent
```

A picklist's values come from **either** an inline `values:` list **or** a
reference to a [global value set](#global-value-sets) via `valueSetName:` —
exactly one of the two:

```yaml
valueSet:
  valueSetName: Industry__gvs  # use a shared global value set instead of inline values
  restricted: true             # optional
```

## Global value sets

A global value set (a.k.a. global picklist) is a reusable list of picklist
values defined **once** and referenced by name from any number of picklist
fields — instead of each field repeating the values inline. It is a top-level
component, so it is declared under a top-level `globalValueSets:` map (which may
appear in its own file or alongside `objects:`), keyed by API name:

```yaml
globalValueSets:
  Industry__gvs:                # API name carries the `__gvs` suffix
    label: Industry             # → masterLabel (human label, no suffix)
    sorted: false               # optional, default false
    description: Shared industry classification
    values:
      - fullName: Technology
        label: Technology
        default: true
      - fullName: Finance
        label: Finance
```

A picklist field then references it with `valueSet.valueSetName` (see
[valueSet](#valueset-picklists) above). The generated component lands beside
`objects/`:

```
force-app/main/default/globalValueSets/Industry__gvs.globalValueSet-meta.xml
```

Anchored on the official `GlobalValueSet` type (`@salesforce/types/metadata`):
the friendly `label` becomes `masterLabel` and `values:` becomes `customValue[]`
(same friendly authoring as an inline picklist).

- **Naming.** A global value set's API name **must end in `__gvs`** — the same
  explicit, no-auto-suffix rule as `__c` for custom objects. Salesforce appends
  `__gvs` itself if you omit it, which silently breaks the name fields reference,
  so `dsfm validate` requires it up front.
- **Reference.** A field's `valueSetName` must resolve to a global value set
  defined in the model — also checked by `dsfm validate`.

## Example — full object (per-file form)

`single-object.yaml`:

```yaml
fullName: Invoice__c
label: Invoice
pluralLabel: Invoices
description: Customer invoices
sharingModel: ReadWrite
deploymentStatus: Deployed
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

  Status__c:
    label: Status
    type: Picklist
    valueSet:
      values:
        - fullName: Draft
          label: Draft
          default: true
        - fullName: Sent
          label: Sent
        - fullName: Paid
          label: Paid

  Account__c:
    label: Account
    type: Lookup
    referenceTo: Account
    relationshipLabel: Invoices
    relationshipName: Invoices
    deleteConstraint: SetNull
```

## Master-detail via nesting

A detail object may be declared inside its master under a `details:` map instead
of as a separate object with a hand-wired `MasterDetail` field. Each entry is a
full object definition; the parser:

1. flattens it into a top-level object (it still emits its own object directory), and
2. generates the `MasterDetail` field on the detail pointing back to the master.

```yaml
objects:
  Project__c:
    label: Project
    pluralLabel: Projects
    nameField:
      fullName: Name
      label: Project Name
      type: Text
    details:
      Project_Task__c:
        label: Project Task
        pluralLabel: Project Tasks
        relationshipName: Tasks          # optional; child relationship on master
        nameField:
          fullName: Name
          label: Task Number
          type: AutoNumber
          displayFormat: TASK-{0000}
        fields:
          Hours__c:
            label: Hours
            type: Number
            precision: 5
            scale: 2
```

The generated field on `Project_Task__c` is equivalent to writing by hand:

```yaml
Project__c:
  label: Project
  type: MasterDetail
  referenceTo: Project__c
  relationshipName: Tasks                # from `relationshipName`, else derived
  relationshipLabel: Project Tasks       # from detail pluralLabel, else relationshipName
```

Rules and limits:

- **`details:` always means master-detail.** Loose references stay normal `Lookup`
  fields and are not nested (their target is independent).
- **Nesting is recursive** — a detail can have its own `details:` (Salesforce
  allows up to 3 levels of master-detail).
- **Optional keys on a detail entry** controlling the generated field:
  `relationshipName`, `relationshipLabel`, `reparentableMasterDetail`.
- **Junction objects (two master-detail parents) cannot be nested** — declare them
  top-level with two explicit `MasterDetail` fields. Both forms desugar to the same
  flat model, so they interoperate.
- A nested detail's API name is global; other objects can still reference it.

## History tracking

Field history tracking is configured with two existing attributes — no extra
metadata file. Set `trackHistory: true` on the fields you want tracked:

```yaml
Project__c:
  fields:
    Stage__c:
      type: Picklist
      trackHistory: true
    Hours__c:
      type: Number
      trackHistory: true
```

This generates:

- `<trackHistory>true</trackHistory>` on each tracked field, and
- `<enableHistory>true</enableHistory>` on the object.

The object-level flag is **auto-wired**: when any field in an object sets
`trackHistory: true`, the parser flips `enableHistory: true` on the object unless
it was set explicitly. This keeps the two flags in sync — a field that tracks
history while its object does not is a deploy error. At deploy time Salesforce
provisions the related history object (e.g. `Project__History`) automatically;
it is system-managed and never authored here.

Both attributes already exist on the official `CustomField` / `CustomObject`
types, so only the cross-object derivation is added in the parser.

## Object feature toggles

Boolean platform-feature switches are passed straight through from YAML to the
object XML (custom objects only):

```yaml
Equipment__c:
  label: Equipment
  pluralLabel: Equipment
  nameField: { fullName: Name, label: Equipment Name, type: Text }
  enableActivities: true
  enableReports: true
  enableSearch: true
  enableFeeds: true
  enableBulkApi: true
  enableStreamingApi: true
```

Supported toggles: `enableActivities`, `enableBulkApi`, `enableFeeds`,
`enableReports`, `enableSearch`, `enableSharing`, `enableStreamingApi`.
(`enableHistory` is separate — auto-wired from field history tracking.)

## Standard objects

To add custom fields to a Salesforce **standard** object (e.g. `Account`), use
the standard API name (no `__c`) as the object key and declare only `fields`:

```yaml
objects:
  Account:
    fields:
      Health_Score__c:
        label: Health Score
        type: Number
        precision: 3
        scale: 0
```

The tool detects the standard object (no `__c`) and emits **only the custom
fields** — no `Account.object-meta.xml` — because a standard object's settings,
label, and name field can't be redefined via deploy. `label`, `pluralLabel`, and
`nameField` are therefore not required for standard objects, and object-level
defaults/toggles do not apply.

## Examples

**Convention: every new use case gets its own example file under `examples/`.**
When a feature or supported pattern is added, add a dedicated, focused example
that demonstrates it (one concept per file) and keep it valid — it should pass
`dsfm validate` and `dsfm generate`. Examples double as living documentation and
as regression fixtures.

Current examples:

| File | Demonstrates |
|------|--------------|
| `examples/single-object.yaml` | Single-object (per-file) layout; common field types |
| `examples/master-detail.yaml` | Explicit master-detail (hand-wired MasterDetail field) |
| `examples/nested-details.yaml` | Master-detail via `details:` nesting |
| `examples/history-tracking.yaml` | Field history tracking + `enableHistory` auto-wiring |
| `examples/object-features.yaml` | Object feature toggles (`enableReports`, etc.) |
| `examples/standard-object.yaml` | Adding custom fields to a standard object (`Account`) |
| `examples/record-types.yaml` | Record types that restrict picklist values per variant |
| `examples/global-value-set.yaml` | A global value set referenced by a picklist field |

## Record types

A record type is a named object variant that can be assigned to users and that
**restricts which picklist values are available** (and picks a per-record-type
default). It is a decomposed child of the object in source format:

```
objects/Account__c/recordTypes/Enterprise.recordType-meta.xml
```

so it nests under the object the same way `details:` does. Declare record types
with a `recordTypes:` map keyed by API name:

```yaml
Account__c:
  fields:
    Segment__c:
      type: Picklist
      valueSet:
        values:
          - fullName: SMB
            label: SMB
          - fullName: MidMarket
            label: Mid-Market
          - fullName: Enterprise
            label: Enterprise
  recordTypes:
    SMB:
      label: SMB
      description: Small and mid-size business accounts   # optional
      active: true                                        # optional, default true
      picklists:
        Segment__c: [SMB]                  # values available for this record type
    Enterprise:
      label: Enterprise
      picklists:
        Segment__c: [Enterprise, MidMarket]  # first listed becomes the default
```

### Generates

`recordTypes/SMB.recordType-meta.xml`:

```xml
<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
    <active>true</active>
    <fullName>SMB</fullName>
    <label>SMB</label>
    <picklistValues>
        <picklist>Segment__c</picklist>
        <values>
            <default>true</default>
            <fullName>SMB</fullName>
        </values>
    </picklistValues>
</RecordType>
```

### Rules and derivations

- **Anchored on the official `RecordType` type** (`@salesforce/types/metadata`):
  `{ active, label, businessProcess?, description?, picklistValues[] }`. The
  friendly `picklists:` form expands into `picklistValues[]`.
- **Emit path** mirrors `fields/` — a `recordTypes/` subfolder under the object.
- **`active`** defaults to `true`. An omitted picklist means all values are
  available (the Salesforce default), so you only declare *restrictions*. The
  **first value listed** in a `picklists:` entry becomes the record type's default.
- **Validation:** a record type's `picklists:` references must resolve to real
  picklist fields on the object and to values that exist in those fields.
- **`businessProcess`:** standard objects (Opportunity, Case, Lead, Solution)
  require one; custom objects don't. Support currently targets custom objects and
  does not emit business processes.
- **Out of scope:** assigning record types to users is `Profile`/`PermissionSet`
  metadata; the RecordType only defines availability.

## Implementation

- **Language / runtime:** TypeScript on Node.
- **Model types:** the in-memory model is anchored on the official
  [`@salesforce/types`](https://www.npmjs.com/package/@salesforce/types)
  (`./metadata` subpath) `CustomObject` / `CustomField` types, generated from
  the Metadata API WSDL — so attribute names and enums are authoritative. We
  relax their required-array members (`DeepPartial`) and re-require the keys we
  always set. A thin YAML-input layer maps friendly authoring onto these shapes.
- **Deployment mechanism:** the CLI emits Salesforce **source XML**
  (`*.object-meta.xml` / `*.field-meta.xml`) into a Salesforce DX source tree.
  The user deploys with `sf project deploy start`. The CLI is a generator, not a
  deployer.
- **A built-in deploy command is deprioritized — not a near-term goal.** The CLI
  stays a generator; deployment is the user's hand-off via `sf project deploy
  start`. Effort goes into broadening *what we can generate* (validation rules,
  formula fields, etc.) rather than into deploying it.
  - *If* it is ever revisited, the approach is settled:
    [`@salesforce/source-deploy-retrieve`](https://www.npmjs.com/package/@salesforce/source-deploy-retrieve)
    (`ComponentSet.fromSource` + `MetadataApiDeploy`) plus `@salesforce/core` for
    auth — a programmatic deploy with no dependency on the `sf` CLI, reusing the
    same generated source tree.

### Testing & deploy verification

Two layers of end-to-end checks live under `e2e/`:

- **`e2e/cli/`** — CLI end-to-end tests (vitest) that run `dsfm` as a subprocess
  and assert on the generated files on disk. No org required; part of `npm test`
  (and `npm run test:e2e`). These run in CI on every push.
- **Deploy verification** — generated XML is only trustworthy if Salesforce
  accepts it. `scripts/verify-deploy.sh` scaffolds a throwaway SFDX project with
  `sf project generate` (nothing Salesforce-specific is committed), generates the
  whole `examples/` model into it, and runs a **check-only deploy**
  (`sf project deploy start --dry-run`) — confirming acceptance without
  persisting anything. The project's `--api-version` pins the `sourceApiVersion`.

- Local/CI deploy runner: `scripts/verify-deploy.sh <org>` (or `npm run verify:deploy -- <org>`).
- CI: `.github/workflows/ci.yml` always runs build + tests; the deploy job runs
  only when an `SFDX_AUTH_URL` secret is configured, authenticating that org and
  running the check-only deploy directly against it (no Dev Hub / scratch org).

### Pipeline

```
YAML files  ->  parse + validate  ->  in-memory model  ->  XML emitter  ->  force-app source tree
```

The YAML → in-memory model → validation stages are independent of the output
target, so a future `--direct` Metadata API mode can reuse everything up to the
emitter.

### Output layout

```
force-app/main/default/objects/
  Invoice__c/
    Invoice__c.object-meta.xml
    fields/
      Amount__c.field-meta.xml
      Status__c.field-meta.xml
      Account__c.field-meta.xml
```

### Likely CLI surface

- `generate` — YAML -> source XML.
- `convert` — source XML -> YAML model (inverse of `generate`). Reads the
  `objects/` layout and reverses the friendly transformations the parser
  applies (inline picklists, record-type `picklists:`, global value sets), so
  the output round-trips: re-generating it reproduces the same source.
  Master-detail relationships are emitted as explicit MasterDetail fields, not
  `details:` nesting. Prints a combined model to stdout or writes one file per
  object to `--out`.
- `validate` — parse + validate only, no output.
- `erd` — render the model as a Mermaid ER diagram (objects as entities,
  Lookup/MasterDetail fields as edges). `--format mmd` (default) prints the
  Mermaid text; `--format svg|png` renders an image via the public mermaid.ink
  service (network required; the schema is sent to a third party) and writes it
  to `--out`. Format is inferred from the `--out` extension when omitted.
- `deploy` — **deprioritized** (see Implementation). The user deploys the
  generated source tree with `sf project deploy start`.

## Open / undecided

- Standard objects: adding custom fields is supported (see "Standard objects").
  Still open: modifying standard-object settings, and adding to non-`__c` custom
  types (`__mdt`, `__e`, `__b`), which are currently treated as standard.
- Field deletion / destructive changes semantics.
- Output directory configurability (default `force-app/main/default`).
- Record types — implemented for custom objects (see "Record types"). Still open:
  business processes and standard-object record types.
