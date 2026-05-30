---
sidebar_position: 3
---

# Picklists

Author picklists with a friendly flattened form; `dsfm` expands it into the
official `valueSet.valueSetDefinition.value[]` shape on the way to source XML.

```yaml
Status__c:
  label: Status
  type: Picklist
  valueSet:
    restricted: true        # optional, defaults true
    values:
      - fullName: Draft
        label: Draft
        default: true
      - fullName: Sent
        label: Sent
      - fullName: Paid
        label: Paid
```

This generates:

```xml
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Status__c</fullName>
    <label>Status</label>
    <type>Picklist</type>
    <valueSet>
        <restricted>true</restricted>
        <valueSetDefinition>
            <sorted>false</sorted>
            <value>
                <default>true</default>
                <fullName>Draft</fullName>
                <label>Draft</label>
            </value>
            <!-- ... -->
        </valueSetDefinition>
    </valueSet>
</CustomField>
```

Notes:

- A value's `label` defaults to its `fullName` if omitted.
- `default: true` on one value marks the picklist default.
- `MultiselectPicklist` uses the same `valueSet` form.

## Reusing values across fields

To share one list of values across many fields, define a
[global value set](/features/global-value-sets) and reference it by name instead
of listing values inline:

```yaml
Industry__c:
  label: Industry
  type: Picklist
  valueSet:
    valueSetName: Industry__gvs   # a shared global value set
    restricted: true
```
