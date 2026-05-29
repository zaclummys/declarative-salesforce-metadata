---
sidebar_position: 1
---

# Master-detail

There are two ways to declare a master-detail relationship.

## Explicit MasterDetail field

Declare both objects, and put a `MasterDetail` field on the detail:

```yaml
Project_Task__c:
  label: Project Task
  pluralLabel: Project Tasks
  fields:
    Project__c:
      label: Project
      type: MasterDetail
      referenceTo: Project__c
      relationshipName: Tasks
      relationshipLabel: Tasks
```

## Nested `details:`

A detail object can be declared **inside** its master under `details:`. Each
entry is a full object; the parser flattens it into a top-level object and
**auto-generates the MasterDetail field** back to the master.

```yaml
objects:
  Project__c:
    label: Project
    pluralLabel: Projects
    nameField:
      fullName: Name
      label: Project Name
      type: Text
    details:
      Project_Task__c:
        label: Project Task
        pluralLabel: Project Tasks
        relationshipName: Tasks      # optional; derived otherwise
        nameField:
          fullName: Name
          label: Task Number
          type: AutoNumber
          displayFormat: TASK-{0000}
        fields:
          Hours__c:
            label: Hours
            type: Number
            precision: 5
            scale: 2
```

The generated field on `Project_Task__c` is equivalent to writing the explicit
`MasterDetail` field by hand.

### Rules

- **`details:` always means master-detail.** Loose references stay normal
  `Lookup` fields and are not nested.
- **Nesting is recursive** — a detail can have its own `details:` (Salesforce
  allows up to 3 levels).
- **Optional keys** on a detail entry control the generated field:
  `relationshipName`, `relationshipLabel`, `reparentableMasterDetail`.
- **Junction objects** (two master-detail parents) can't be nested — declare them
  top-level with two explicit `MasterDetail` fields.
