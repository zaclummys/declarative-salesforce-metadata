---
sidebar_position: 4
---

# Standard objects

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

      Account_Tier__c:
        label: Account Tier
        type: Picklist
        valueSet:
          values:
            - fullName: Bronze
              label: Bronze
              default: true
            - fullName: Gold
              label: Gold
```

The tool detects the standard object (no `__c`) and emits **only the custom
fields**:

```
force-app/main/default/objects/Account/fields/
├── Health_Score__c.field-meta.xml
└── Account_Tier__c.field-meta.xml
```

No `Account.object-meta.xml` is written, because a standard object's settings,
label, and name field can't be redefined via deploy. As a result:

- `label`, `pluralLabel`, and `nameField` are **not required** for standard objects.
- Object-level defaults and [feature toggles](/features/object-features) do
  **not** apply.

:::caution
Non-`__c` custom types (`__mdt`, `__e`, `__b`) are currently treated as standard
objects. Full support for those is not yet implemented.
:::
