/**
 * Convert a Salesforce DX source tree back into a YAML model — the inverse of
 * the emitter. It reads the `objects/<Name>/` layout (object-meta, fields/,
 * recordTypes/) plus top-level `globalValueSets/`, and reverses the friendly
 * transformations the parser applies, so the YAML round-trips: feeding the
 * output back through `generate` reproduces the same source.
 *
 * Master-detail relationships are emitted as explicit MasterDetail fields (the
 * single-file form), not reconstructed into `details:` nesting.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { stringify as stringifyYaml } from "yaml";
import { ParseError } from "./parser.js";

/** Tags that repeat in the metadata XML and must always parse as arrays. */
const ARRAY_TAGS = new Set(["value", "values", "picklistValues", "customValue"]);

const parser = new XMLParser({
  ignoreAttributes: true, // drop the xmlns attribute
  isArray: (name) => ARRAY_TAGS.has(name),
});

/** The friendly, YAML-ready shape: objects and global value sets keyed by API name. */
export interface FriendlyModel {
  objects: Record<string, Record<string, unknown>>;
  globalValueSets: Record<string, Record<string, unknown>>;
}

/** Read a source tree into the friendly model. `source` may be the source root
 *  (containing `objects/`) or the `objects/` directory itself. */
export function readSource(source: string): FriendlyModel {
  if (!existsSync(source)) {
    throw new ParseError(`path does not exist: ${source}`);
  }

  const hasObjectsChild = existsSync(join(source, "objects"));
  const objectsRoot = hasObjectsChild ? join(source, "objects") : source;
  const gvsRoot = hasObjectsChild
    ? join(source, "globalValueSets")
    : join(dirname(source), "globalValueSets");

  if (!existsSync(objectsRoot)) {
    throw new ParseError(`no objects/ directory found under ${source}`);
  }

  const objects: FriendlyModel["objects"] = {};
  for (const entry of readdirSync(objectsRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      objects[entry.name] = readObjectDir(join(objectsRoot, entry.name), entry.name);
    }
  }

  const globalValueSets: FriendlyModel["globalValueSets"] = {};
  if (existsSync(gvsRoot)) {
    for (const file of readdirSync(gvsRoot)) {
      if (!file.endsWith(".globalValueSet-meta.xml")) continue;
      const apiName = basename(file, ".globalValueSet-meta.xml");
      const body = parseXml(join(gvsRoot, file)).GlobalValueSet as Record<string, unknown>;
      globalValueSets[apiName] = friendlyGlobalValueSet(body);
    }
  }

  return { objects, globalValueSets };
}

/** Render the friendly model as a single multi-object YAML document. */
export function combinedYaml(fm: FriendlyModel): string {
  const doc: Record<string, unknown> = {};
  if (Object.keys(fm.globalValueSets).length > 0) doc.globalValueSets = fm.globalValueSets;
  doc.objects = fm.objects;
  return stringifyYaml(doc, { lineWidth: 0 });
}

/** Render each object to its own single-object YAML string, keyed by file name. */
export function splitYaml(fm: FriendlyModel): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [apiName, body] of Object.entries(fm.objects)) {
    files[`${apiName}.yaml`] = stringifyYaml({ fullName: apiName, ...body }, { lineWidth: 0 });
  }
  if (Object.keys(fm.globalValueSets).length > 0) {
    files["globalValueSets.yaml"] = stringifyYaml(
      { globalValueSets: fm.globalValueSets },
      { lineWidth: 0 }
    );
  }
  return files;
}

function readObjectDir(objDir: string, apiName: string): Record<string, unknown> {
  const objMeta = join(objDir, `${apiName}.object-meta.xml`);
  const objBody = existsSync(objMeta)
    ? (parseXml(objMeta).CustomObject as Record<string, unknown>)
    : {};

  const fields: Record<string, unknown> = {};
  const fieldsDir = join(objDir, "fields");
  if (existsSync(fieldsDir)) {
    for (const file of readdirSync(fieldsDir).sort()) {
      if (!file.endsWith(".field-meta.xml")) continue;
      const [name, body] = friendlyField(parseXml(join(fieldsDir, file)).CustomField);
      fields[name] = body;
    }
  }

  const recordTypes: Record<string, unknown> = {};
  const rtDir = join(objDir, "recordTypes");
  if (existsSync(rtDir)) {
    for (const file of readdirSync(rtDir).sort()) {
      if (!file.endsWith(".recordType-meta.xml")) continue;
      const [name, body] = friendlyRecordType(parseXml(join(rtDir, file)).RecordType);
      recordTypes[name] = body;
    }
  }

  return friendlyObject(objBody, fields, recordTypes);
}

/** Object body with a stable, readable key order: identity first, then fields/recordTypes last. */
function friendlyObject(
  objBody: Record<string, unknown>,
  fields: Record<string, unknown>,
  recordTypes: Record<string, unknown>
): Record<string, unknown> {
  const { nameField, label, pluralLabel, ...rest } = objBody;
  const out: Record<string, unknown> = {};
  if (label !== undefined) out.label = label;
  if (pluralLabel !== undefined) out.pluralLabel = pluralLabel;
  for (const key of Object.keys(rest).sort()) out[key] = rest[key];
  if (nameField !== undefined) out.nameField = nameField;
  out.fields = fields;
  if (Object.keys(recordTypes).length > 0) out.recordTypes = recordTypes;
  return out;
}

function friendlyField(xml: Record<string, any>): [string, Record<string, unknown>] {
  const { fullName, label, type, valueSet, ...rest } = xml;
  const body: Record<string, unknown> = { label, type };
  for (const key of Object.keys(rest).sort()) body[key] = rest[key];
  if (valueSet !== undefined) body.valueSet = friendlyValueSet(valueSet);
  return [fullName, body];
}

/**
 * Reverse the picklist transformation. An inline value set
 * (`valueSetDefinition.value[]`) collapses to the friendly `values:` list; a
 * global reference (`valueSetName`) passes through unchanged.
 */
function friendlyValueSet(vs: Record<string, any>): Record<string, unknown> {
  if (!vs.valueSetDefinition) return vs;
  const out: Record<string, unknown> = {};
  if (vs.restricted !== undefined) out.restricted = vs.restricted;
  if (vs.valueSetDefinition.sorted) out.sorted = true;
  out.values = (vs.valueSetDefinition.value ?? []).map((v: Record<string, any>) => {
    const value: Record<string, unknown> = { fullName: v.fullName };
    if (v.label !== undefined && v.label !== v.fullName) value.label = v.label;
    if (v.default) value.default = true;
    return value;
  });
  return out;
}

/**
 * Reverse the record-type transformation: `picklistValues[]` collapses to the
 * friendly `picklists:` map of value lists, with the default value first (the
 * parser treats the first listed value as the default).
 */
function friendlyRecordType(xml: Record<string, any>): [string, Record<string, unknown>] {
  const { fullName, label, active, description, picklistValues, ...rest } = xml;
  const body: Record<string, unknown> = {};
  if (label !== undefined) body.label = label;
  if (active === false) body.active = false; // true is the default — omit it
  if (description !== undefined) body.description = description;
  for (const key of Object.keys(rest).sort()) body[key] = rest[key];

  if (picklistValues) {
    const picklists: Record<string, string[]> = {};
    for (const pv of picklistValues) {
      const values = (pv.values ?? []) as Record<string, any>[];
      const ordered = [...values.filter((v) => v.default), ...values.filter((v) => !v.default)];
      picklists[pv.picklist] = ordered.map((v) => v.fullName);
    }
    body.picklists = picklists;
  }
  return [fullName, body];
}

/** Reverse the global-value-set transformation: `masterLabel`→`label`, `customValue`→`values`. */
function friendlyGlobalValueSet(xml: Record<string, any>): Record<string, unknown> {
  const { masterLabel, customValue, sorted, description, ...rest } = xml;
  const body: Record<string, unknown> = { label: masterLabel };
  if (description !== undefined) body.description = description;
  if (sorted) body.sorted = true;
  for (const key of Object.keys(rest).sort()) body[key] = rest[key];
  body.values = (customValue ?? []).map((v: Record<string, any>) => {
    const value: Record<string, unknown> = { fullName: v.fullName };
    if (v.label !== undefined && v.label !== v.fullName) value.label = v.label;
    if (v.default) value.default = true;
    return value;
  });
  return body;
}

/** Parse a metadata XML file, coercing `true`/`false` text to booleans. */
function parseXml(file: string): Record<string, any> {
  return coerceBooleans(parser.parse(readFileSync(file, "utf8")));
}

/** strnum (fast-xml-parser) coerces numbers but not booleans — do that here. */
function coerceBooleans(value: unknown): any {
  if (Array.isArray(value)) return value.map(coerceBooleans);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = coerceBooleans(v);
    return out;
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
