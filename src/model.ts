/**
 * In-memory model, anchored on the official Salesforce Metadata API types
 * (generated from the Metadata WSDL). The parser produces this model, the
 * validator checks it, and the emitter serializes it to source XML.
 *
 * The official `CustomObject` / `CustomField` types carry many required-array
 * members we never set (actionOverrides, listViews, summaryFilterItems, ...),
 * so we relax them with `DeepPartial` while keeping the official attribute
 * names and enums. The keys we always populate are re-required on top.
 */
import type {
  CustomObject as SfCustomObject,
  CustomField as SfCustomField,
  RecordType as SfRecordType,
  FieldType,
} from "@salesforce/types/metadata";

export type { FieldType } from "@salesforce/types/metadata";

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** A custom field — official `CustomField`, with the keys we always set required. */
export type Field = DeepPartial<SfCustomField> & {
  fullName: string;
  label: string;
  type: FieldType;
};

/** The record Name field nested in a CustomObject. */
export type NameField = DeepPartial<SfCustomField> & {
  fullName: string;
  label: string;
  type: FieldType;
};

/** A record type — official `RecordType`, with the keys we always set required. */
export type RecordType = DeepPartial<SfRecordType> & {
  fullName: string;
  label: string;
};

/** A custom object — official `CustomObject`, relaxed for hand construction. */
export type SObject = DeepPartial<SfCustomObject> & {
  fullName: string;
  label: string;
  pluralLabel: string;
  fields: Field[];
  nameField?: NameField;
  recordTypes?: RecordType[];
};

export interface Model {
  objects: SObject[];
}

/**
 * Field types supported in v1. The official `FieldType` union is broader; we
 * validate against this subset and reject the rest as unsupported for now.
 *
 * Note: there is no "Formula" type — a formula field uses its return type as
 * `type` (Text, Currency, Number, ...) plus a `formula` attribute.
 */
export const FIELD_TYPES: readonly FieldType[] = [
  "Text",
  "TextArea",
  "LongTextArea",
  "Number",
  "Currency",
  "Percent",
  "Checkbox",
  "Date",
  "DateTime",
  "Email",
  "Phone",
  "Url",
  "Picklist",
  "MultiselectPicklist",
  "Lookup",
  "MasterDetail",
  "AutoNumber",
];

/**
 * Boolean object-level feature toggles passed through from YAML to the object
 * XML. `enableHistory` is handled separately (auto-wired from field tracking).
 */
export const OBJECT_FEATURE_TOGGLES = [
  "enableActivities",
  "enableBulkApi",
  "enableFeeds",
  "enableReports",
  "enableSearch",
  "enableSharing",
  "enableStreamingApi",
] as const;

/**
 * Whether an object API name is a custom object (`__c`). Standard objects (e.g.
 * `Account`) only receive added custom fields — no object-meta.xml, no object
 * defaults — so the emitter and validator branch on this.
 */
export function isCustomObject(fullName: string): boolean {
  return fullName.endsWith("__c");
}
