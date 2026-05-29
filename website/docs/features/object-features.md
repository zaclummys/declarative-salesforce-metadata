---
sidebar_position: 3
---

# Object feature toggles

Boolean platform-feature switches are passed straight through from YAML to the
object XML (custom objects only):

```yaml
Equipment__c:
  label: Equipment
  pluralLabel: Equipment
  nameField:
    fullName: Name
    label: Equipment Name
    type: Text
  enableActivities: true
  enableReports: true
  enableSearch: true
  enableFeeds: true
  enableBulkApi: true
  enableStreamingApi: true
  fields:
    Serial_Number__c:
      label: Serial Number
      type: Text
      length: 60
      unique: true
```

## Supported toggles

| Toggle | Enables |
|--------|---------|
| `enableActivities` | Tasks/events on records |
| `enableBulkApi` | Bulk API access |
| `enableFeeds` | Chatter feed on records |
| `enableReports` | Available in the report builder |
| `enableSearch` | Included in global search |
| `enableSharing` | Sharing |
| `enableStreamingApi` | Streaming API |

:::tip
`enableHistory` is handled separately — it is auto-wired from field
[history tracking](/features/history-tracking).
:::
