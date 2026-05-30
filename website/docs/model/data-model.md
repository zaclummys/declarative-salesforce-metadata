---
sidebar_position: 1
---

# Data model

## File layout

A model is loaded from a **single file** or a **directory**. When you point at a
directory, **all** `.yaml`/`.yml` files under it (recursively) are loaded and
merged into one model. Each file may use either form below, and they can be mixed.

### Single-object file

```yaml
fullName: Invoice__c
label: Invoice
# ...
```

The object *is* the document, and **requires a top-level `fullName`** (the exact
API name), so renaming the file never changes the deployed API name.

### Multi-object file

```yaml
objects:
  Invoice__c:
    label: Invoice
    # ...
```

A top-level `objects:` map keyed by API name. Here the key *is* the API name, so
`fullName` is omitted.

### Directory

```
my-model/
  Invoice__c.yaml          # single-object file
  relationships.yaml       # multi-object file
  subfolder/Order__c.yaml  # nested files are loaded too
```

All files are merged; duplicate object API names across files are a validation
error.

## Object schema

| Key | Required | Notes |
|-----|----------|-------|
| `fullName` | per-file only | Exact API name, e.g. `Invoice__c`. |
| `label` | custom objects | Human label. |
| `pluralLabel` | custom objects | Plural human label. |
| `description` | no | |
| `sharingModel` | no | Default `ReadWrite` (custom objects). |
| `deploymentStatus` | no | Default `Deployed` (custom objects). |
| `nameField` | custom objects | The record Name field. |
| `fields` | no | Map of custom fields keyed by exact API name. |

Names and labels are written explicitly — the YAML maps 1:1 onto the Salesforce
Metadata API.

### nameField

```yaml
nameField:
  fullName: Name
  label: Invoice Number
  type: AutoNumber          # or Text
  displayFormat: INV-{0000} # AutoNumber only
```

## Fields

Fields are a **keyed map** — the key is the exact API name (e.g. `Amount__c`),
which prevents duplicate field names:

```yaml
fields:
  Amount__c:
    label: Amount
    type: Currency
    precision: 16
    scale: 2
    required: true
```

See [Field types](/model/field-types) for the catalog and per-type rules.
