---
sidebar_position: 5
---

# Record types

A record type is a named object variant that can be assigned to users and that
**restricts which picklist values are available** (and picks a per-record-type
default). Declare them with a `recordTypes:` map keyed by API name:

```yaml
Account__c:
  label: Account
  pluralLabel: Accounts
  nameField:
    fullName: Name
    label: Account Name
    type: Text
  fields:
    Segment__c:
      label: Segment
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
      picklists:
        Segment__c: [SMB]                  # only SMB available; it is the default
    Enterprise:
      label: Enterprise
      picklists:
        Segment__c: [Enterprise, MidMarket]  # first listed becomes the default
```

Each record type is a decomposed child of the object in source format, emitted
under a `recordTypes/` subfolder:

```
objects/Account__c/recordTypes/Enterprise.recordType-meta.xml
```

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

## Keys

| Key | Notes |
|-----|-------|
| `label` | required; the human label |
| `active` | optional, default `true` |
| `description` | optional |
| `picklists` | map of picklist field API name → list of available values |

## Rules

- An **omitted picklist** means all of its values are available (the Salesforce
  default) — you only declare *restrictions*.
- The **first value listed** in a `picklists:` entry becomes the record type's
  default.
- Every `picklists:` reference must resolve to a real picklist field on the
  object and to values that exist in that field — checked by `dsfm validate`.

:::note
Assigning record types to users lives in `Profile`/`PermissionSet` metadata; a
record type only defines availability. Business processes (required for some
standard objects) are not yet emitted — support currently targets custom objects.
:::
