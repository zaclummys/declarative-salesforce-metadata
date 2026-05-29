---
sidebar_position: 2
---

# Getting started

## Install

```bash
npm install
npm run build       # compile the CLI to dist/
```

During development you can run the CLI without building:

```bash
npx tsx src/index.ts <command> <args>
```

## Define a model

Create a file `model.yaml`:

```yaml
objects:
  Invoice__c:
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

## Validate and generate

```bash
# Check the model without writing anything
dsfm validate model.yaml

# Generate Salesforce source XML
dsfm generate model.yaml --out force-app/main/default
```

This writes:

```
force-app/main/default/objects/Invoice__c/
├── Invoice__c.object-meta.xml
└── fields/
    └── Amount__c.field-meta.xml
```

## Deploy

Use the Salesforce CLI:

```bash
sf project deploy start --source-dir force-app/main/default
```

See [Deployment](/deployment) for verification in CI.
