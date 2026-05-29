---
sidebar_position: 1
---

# Data model

## File layout

The model can be expressed two ways; both produce the same in-memory model.

### Per-object files

```
objects/
  Invoice__c.yaml
  Invoice_Line__c.yaml
```

The tool reads `objects/*.yaml`. Each file declares one object and **requires a
top-level `fullName`** (the exact API name), so renaming a file never changes the
deployed API name.

### Single file

```yaml
objects:
  Invoice__c:
    label: Invoice
    # ...
```

A top-level `objects:` map keyed by API name. Here the key *is* the API name, so
`fullName` is omitted.

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
