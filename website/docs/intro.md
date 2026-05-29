---
sidebar_position: 1
slug: /
---

# Introduction

**declarative-sf-metadata** (`dsfm`) lets you define Salesforce **custom objects**
and **custom fields** declaratively in YAML, then generates Salesforce DX source
metadata (`*.object-meta.xml` / `*.field-meta.xml`) you deploy with the Salesforce
CLI.

You write a concise model:

```yaml
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
```

…and `dsfm` produces the deployable source tree.

## Why

- **One source of truth.** Your data model lives in readable, reviewable YAML
  instead of sprawling XML spread across many files.
- **Faithful to Salesforce.** The model is anchored on the official
  `@salesforce/types` metadata definitions, so attribute names and enums map
  1:1 onto the Metadata API — no hidden translation layer.
- **Conveniences where they help.** Nested master-detail, auto-wired history
  tracking, and object feature toggles reduce boilerplate without inventing a
  new mini-language.

## Scope

This version covers **custom objects** and **custom fields**, including adding
custom fields to **standard objects**. See [Field types](/model/field-types)
for the supported catalog.

Continue to [Getting started](/getting-started).
