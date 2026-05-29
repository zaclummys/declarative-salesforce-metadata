import { FIELD_TYPES, isCustomObject, type Field, type FieldType, type Model, type SObject } from "./model.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Required type-specific keys per field type (from SPEC.md). */
const REQUIRED_KEYS: Partial<Record<FieldType, (keyof Field)[]>> = {
  Text: ["length"],
  LongTextArea: ["length", "visibleLines"],
  Number: ["precision", "scale"],
  Currency: ["precision", "scale"],
  Percent: ["precision", "scale"],
  Checkbox: ["defaultValue"],
  Picklist: ["valueSet"],
  MultiselectPicklist: ["valueSet"],
  Lookup: ["referenceTo", "relationshipName"],
  MasterDetail: ["referenceTo", "relationshipName"],
  AutoNumber: ["displayFormat"],
};

export function validate(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenObjects = new Set<string>();

  for (const obj of model.objects) {
    if (seenObjects.has(obj.fullName)) {
      issues.push({ path: obj.fullName, message: "duplicate object fullName" });
    }
    seenObjects.add(obj.fullName);
    validateObject(obj, issues);
  }

  return issues;
}

function validateObject(obj: SObject, issues: ValidationIssue[]): void {
  const at = (msg: string) => issues.push({ path: obj.fullName, message: msg });

  // Standard objects only receive added custom fields, so object metadata
  // (label, pluralLabel, nameField) is required for custom objects only.
  if (isCustomObject(obj.fullName)) {
    if (!obj.label) at("missing `label`");
    if (!obj.pluralLabel) at("missing `pluralLabel`");
    if (!obj.nameField) at("custom object requires a `nameField`");
  }
  if (obj.nameField?.type === "AutoNumber" && !obj.nameField.displayFormat) {
    at("nameField of type AutoNumber requires `displayFormat`");
  }

  const seenFields = new Set<string>();
  for (const field of obj.fields) {
    const fieldPath = `${obj.fullName}.${field.fullName}`;
    if (seenFields.has(field.fullName)) {
      issues.push({ path: fieldPath, message: "duplicate field fullName" });
    }
    seenFields.add(field.fullName);
    validateField(field, fieldPath, issues);
  }
}

function validateField(field: Field, path: string, issues: ValidationIssue[]): void {
  const at = (msg: string) => issues.push({ path, message: msg });

  if (!field.label) at("missing `label`");
  if (!field.type) {
    at("missing `type`");
    return;
  }
  if (!FIELD_TYPES.includes(field.type)) {
    at(`unknown field type "${field.type}"`);
    return;
  }

  for (const key of REQUIRED_KEYS[field.type] ?? []) {
    if (field[key] === undefined || field[key] === null) {
      at(`type ${field.type} requires \`${String(key)}\``);
    }
  }

  if (field.valueSet && (field.valueSet.valueSetDefinition?.value?.length ?? 0) === 0) {
    at("valueSet must contain at least one value");
  }
}
