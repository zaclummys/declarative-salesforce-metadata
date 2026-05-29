---
sidebar_position: 2
---

# History tracking

Mark fields with `trackHistory: true` to record changes:

```yaml
Support_Case__c:
  label: Support Case
  pluralLabel: Support Cases
  nameField:
    fullName: Name
    label: Case Number
    type: AutoNumber
    displayFormat: CASE-{0000}
  fields:
    Status__c:
      label: Status
      type: Picklist
      trackHistory: true
      valueSet:
        values:
          - fullName: New
            label: New
            default: true
          - fullName: Closed
            label: Closed
```

This generates:

- `<trackHistory>true</trackHistory>` on each tracked field, and
- `<enableHistory>true</enableHistory>` on the object.

## Auto-wiring

The object-level `enableHistory` flag is **set automatically** whenever any field
sets `trackHistory: true` (unless you set it explicitly). This keeps the two flags
in sync — a field that tracks history while its object does not is a deploy error.

At deploy time Salesforce provisions the related history object (e.g.
`Support_Case__History`) automatically; it is system-managed and never authored
here.
