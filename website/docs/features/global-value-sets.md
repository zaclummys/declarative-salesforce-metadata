---
sidebar_position: 6
---

# Global value sets

A **global value set** (a.k.a. global picklist) is a reusable list of picklist
values defined once and referenced by name from any number of picklist fields —
instead of each field repeating the values inline.

It is a top-level component, so it lives under a top-level `globalValueSets:`
map (in its own file or alongside `objects:`), keyed by API name:

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
      - fullName: Retail
        label: Retail
```

This generates `globalValueSets/Industry__gvs.globalValueSet-meta.xml`, a sibling
of `objects/`:

```xml
<GlobalValueSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <customValue>
        <default>true</default>
        <fullName>Technology</fullName>
        <label>Technology</label>
    </customValue>
    <!-- ... -->
    <masterLabel>Industry</masterLabel>
    <sorted>false</sorted>
</GlobalValueSet>
```

## Referencing it from a field

A picklist field points at the set with `valueSet.valueSetName` instead of
declaring inline `values`:

```yaml
Industry__c:
  label: Industry
  type: Picklist
  valueSet:
    valueSetName: Industry__gvs
    restricted: true          # optional
```

## Keys

| Key | Notes |
|-----|-------|
| `label` | required; the human label (emitted as `masterLabel`) |
| `sorted` | optional, default `false` |
| `description` | optional |
| `values` | the shared values, authored exactly like an inline picklist |

## Rules

- The API name **must end in `__gvs`** (the same explicit, no-auto-suffix rule
  as `__c` for custom objects). Salesforce appends `__gvs` itself if you omit it,
  silently breaking the name your fields reference, so `dsfm validate` requires it.
- The friendly `label` becomes `masterLabel`; `values:` becomes `customValue[]`.
- A field's `valueSetName` must resolve to a global value set defined in the
  model — checked by `dsfm validate`.
- A picklist draws its values from **either** an inline `values:` list **or** a
  `valueSetName` reference — not both.
