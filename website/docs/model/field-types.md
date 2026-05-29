---
sidebar_position: 2
---

# Field types

## Catalog

`Text`, `TextArea`, `LongTextArea`, `Number`, `Currency`, `Percent`, `Checkbox`,
`Date`, `DateTime`, `Email`, `Phone`, `Url`, `Picklist`, `MultiselectPicklist`,
`Lookup`, `MasterDetail`, `AutoNumber`.

:::note
There is **no** `Formula` field type in Salesforce. A formula field is a field
of its *return type* (`Text`, `Currency`, `Number`, …) plus a `formula`
attribute.
:::

## Per-type required keys

| Type(s) | Required keys | Optional keys |
|---------|---------------|---------------|
| `Text` | `length` | `unique`, `caseSensitive` |
| `TextArea` | — | |
| `LongTextArea` | `length`, `visibleLines` | |
| `Number`, `Currency`, `Percent` | `precision`, `scale` | `unique` (Number) |
| `Checkbox` | `defaultValue` | |
| `Date`, `DateTime` | — | |
| `Email`, `Phone`, `Url` | — | `unique` (Email) |
| `Picklist`, `MultiselectPicklist` | `valueSet` | |
| `Lookup` | `referenceTo`, `relationshipName` | `relationshipLabel`, `deleteConstraint` |
| `MasterDetail` | `referenceTo`, `relationshipName` | `relationshipLabel`, `reparentableMasterDetail` |
| `AutoNumber` | `displayFormat` | |

`dsfm validate` enforces these before generating anything.

## Common keys (all types)

| Key | Notes |
|-----|-------|
| `label` | required |
| `type` | required |
| `required` | optional, default false |
| `description` | optional |
| `unique` | where the type allows it |
| `trackHistory` | see [History tracking](/features/history-tracking) |
