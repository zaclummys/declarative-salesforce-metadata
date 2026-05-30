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

  const globalValueSets = validateGlobalValueSets(model, issues);

  const seenObjects = new Set<string>();
  for (const obj of model.objects) {
    if (seenObjects.has(obj.fullName)) {
      issues.push({ path: obj.fullName, message: "duplicate object fullName" });
    }
    seenObjects.add(obj.fullName);
    validateObject(obj, issues, globalValueSets);
  }

  return issues;
}

/** Validate the global value sets and return the set of names defined in the model. */
function validateGlobalValueSets(model: Model, issues: ValidationIssue[]): Set<string> {
  const seen = new Set<string>();
  for (const gvs of model.globalValueSets ?? []) {
    const path = `globalValueSets.${gvs.fullName}`;
    const at = (msg: string) => issues.push({ path, message: msg });
    if (seen.has(gvs.fullName)) at("duplicate global value set fullName");
    seen.add(gvs.fullName);
    // Salesforce names global value sets with a `__gvs` suffix (like `__c` for
    // custom objects). Require it explicitly — otherwise the platform appends it
    // silently and the deployed name won't match what fields reference.
    if (!gvs.fullName.endsWith("__gvs")) at("API name must end with `__gvs`");
    if (!gvs.masterLabel) at("missing `label`");
    if ((gvs.customValue?.length ?? 0) === 0) at("must contain at least one value");
  }
  return seen;
}

function validateObject(obj: SObject, issues: ValidationIssue[], globalValueSets: Set<string>): void {
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
    validateField(field, fieldPath, issues, globalValueSets);
  }

  validateRecordTypes(obj, issues);
}

/**
 * A record type's `picklists:` references must resolve to real picklist fields
 * on the object and to values that actually exist in those fields' value sets.
 */
function validateRecordTypes(obj: SObject, issues: ValidationIssue[]): void {
  if (!obj.recordTypes?.length) return;

  // Map each picklist field to the set of values it defines.
  const picklistValues = new Map<string, Set<string>>();
  for (const field of obj.fields) {
    if (field.type !== "Picklist" && field.type !== "MultiselectPicklist") continue;
    const values = field.valueSet?.valueSetDefinition?.value ?? [];
    picklistValues.set(field.fullName, new Set(values.map((v) => v?.fullName as string)));
  }

  const seen = new Set<string>();
  for (const rt of obj.recordTypes) {
    const rtPath = `${obj.fullName}.recordTypes.${rt.fullName}`;
    const at = (msg: string) => issues.push({ path: rtPath, message: msg });
    if (seen.has(rt.fullName)) at("duplicate record type fullName");
    seen.add(rt.fullName);
    if (!rt.label) at("missing `label`");

    for (const pv of rt.picklistValues ?? []) {
      const field = pv?.picklist as string;
      const defined = picklistValues.get(field);
      if (!defined) {
        at(`picklist \`${field}\` is not a picklist field on this object`);
        continue;
      }
      for (const v of pv?.values ?? []) {
        if (!defined.has(v?.fullName as string)) {
          at(`picklist \`${field}\` has no value \`${v?.fullName}\``);
        }
      }
    }
  }
}

function validateField(
  field: Field,
  path: string,
  issues: ValidationIssue[],
  globalValueSets: Set<string>
): void {
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

  // A picklist's values come from either an inline `valueSetDefinition` or a
  // reference to a global value set (`valueSetName`) — exactly one is required.
  if (field.valueSet) {
    const { valueSetName, valueSetDefinition } = field.valueSet;
    if (valueSetName) {
      if (!globalValueSets.has(valueSetName)) {
        at(`references unknown global value set \`${valueSetName}\``);
      }
    } else if ((valueSetDefinition?.value?.length ?? 0) === 0) {
      at("valueSet must contain at least one value (or a `valueSetName`)");
    }
  }
}
