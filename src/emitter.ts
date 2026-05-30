import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { XMLBuilder } from "fast-xml-parser";
import { isCustomObject, type Field, type Model, type SObject } from "./model.js";

const XMLNS = "http://soap.sforce.com/2006/04/metadata";

const builder = new XMLBuilder({
  format: true,
  indentBy: "    ",
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressEmptyNode: true,
});

export interface EmitResult {
  files: string[];
}

/** Emit a full Salesforce DX source tree under `<outDir>/objects`. */
export function emit(model: Model, outDir: string): EmitResult {
  const files: string[] = [];
  const objectsRoot = join(outDir, "objects");

  for (const obj of model.objects) {
    const objDir = join(objectsRoot, obj.fullName);
    const fieldsDir = join(objDir, "fields");
    mkdirSync(fieldsDir, { recursive: true });

    // Standard objects get only their added custom fields — no object-meta.xml
    // (its settings can't be redefined on a standard object via deploy).
    if (isCustomObject(obj.fullName)) {
      const objFile = join(objDir, `${obj.fullName}.object-meta.xml`);
      writeFileSync(objFile, objectXml(obj));
      files.push(objFile);
    }

    for (const field of obj.fields) {
      const fieldFile = join(fieldsDir, `${field.fullName}.field-meta.xml`);
      writeFileSync(fieldFile, fieldXml(field));
      files.push(fieldFile);
    }

    // Record types are decomposed children, mirroring `fields/`: each lands in
    // its own file under a `recordTypes/` subfolder of the object.
    for (const rt of obj.recordTypes ?? []) {
      const rtDir = join(objDir, "recordTypes");
      mkdirSync(rtDir, { recursive: true });
      const rtFile = join(rtDir, `${rt.fullName}.recordType-meta.xml`);
      writeFileSync(rtFile, document("RecordType", rt));
      files.push(rtFile);
    }
  }

  return { files };
}

/**
 * The model is shaped exactly like the Metadata API `CustomObject`/`CustomField`,
 * so we serialize it generically. In *source* format the object's fields live in
 * their own files, so they are omitted from the object XML.
 */
function objectXml(obj: SObject): string {
  // In source format the folder name carries the API name, and fields and record
  // types live in their own files — so all are omitted from the object XML body.
  const { fields, fullName, recordTypes, ...objectBody } = obj;
  return document("CustomObject", objectBody);
}

function fieldXml(field: Field): string {
  return document("CustomField", field);
}

function document(rootTag: string, body: object): string {
  const cleaned = (clean(body) as Record<string, unknown>) ?? {};
  const xml = builder.build({ [rootTag]: { "@_xmlns": XMLNS, ...cleaned } });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

/**
 * Recursively drop undefined/null values and empty arrays/objects, and sort
 * keys for deterministic output (mirroring how the Salesforce CLI writes source).
 */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) {
    const arr = value.map(clean).filter((v) => v !== undefined);
    return arr.length > 0 ? arr : undefined;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const cleaned = clean((value as Record<string, unknown>)[key]);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return value === null ? undefined : value;
}
