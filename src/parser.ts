import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { isCustomObject, OBJECT_FEATURE_TOGGLES, type Field, type Model, type SObject } from "./model.js";

const DEFAULT_SHARING_MODEL = "ReadWrite";
const DEFAULT_DEPLOYMENT_STATUS = "Deployed";

export class ParseError extends Error {
  constructor(message: string, public readonly file?: string) {
    super(file ? `${file}: ${message}` : message);
    this.name = "ParseError";
  }
}

/**
 * Resolve a model from a path. The path may be:
 *  - a directory containing `objects/<Name>.yaml` files (per-object layout), or
 *  - a single YAML file with a top-level `objects:` map (single-file layout).
 */
export function loadModel(inputPath: string): Model {
  if (!existsSync(inputPath)) {
    throw new ParseError(`path does not exist: ${inputPath}`);
  }
  return statSync(inputPath).isDirectory()
    ? loadFromDirectory(inputPath)
    : loadFromSingleFile(inputPath);
}

function loadFromDirectory(dir: string): Model {
  const objectsDir = existsSync(join(dir, "objects")) ? join(dir, "objects") : dir;
  const files = readdirSync(objectsDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => join(objectsDir, f));

  if (files.length === 0) {
    throw new ParseError(`no .yaml files found in ${objectsDir}`);
  }

  const objects = files.flatMap((file) => {
    const raw = parseYaml(readFileSync(file, "utf8")) ?? {};
    if (typeof raw !== "object") {
      throw new ParseError("expected a mapping at the top level", file);
    }
    if (!raw.fullName) {
      throw new ParseError("per-object files require a top-level `fullName`", file);
    }
    return buildObjects(raw.fullName, raw, file);
  });

  return { objects };
}

function loadFromSingleFile(file: string): Model {
  const raw = parseYaml(readFileSync(file, "utf8")) ?? {};
  const objectsMap = raw.objects;
  if (!objectsMap || typeof objectsMap !== "object") {
    throw new ParseError("single-file model requires a top-level `objects` map", file);
  }
  const objects = Object.entries(objectsMap).flatMap(([apiName, def]) =>
    buildObjects(apiName, def as Record<string, unknown>, file)
  );
  return { objects };
}

/**
 * Build an object and, recursively, any objects nested under its `details:` key.
 * A detail is a full object in its own right; nesting only adds an auto-generated
 * MasterDetail field on the detail pointing back to its master, and flattens the
 * tree into the list the rest of the pipeline expects. `master` is supplied when
 * this node is itself a detail.
 */
function buildObjects(fullName: string, raw: any, file: string, master?: SObject): SObject[] {
  const { details, relationshipName, relationshipLabel, reparentableMasterDetail, ...objectRaw } =
    raw ?? {};

  const obj = toSObject(fullName, objectRaw, file);

  // When this object is nested under a master, synthesize the master-detail link.
  if (master) {
    obj.fields.unshift(
      masterDetailField(master, {
        relationshipName,
        relationshipLabel,
        reparentableMasterDetail,
        detailPlural: obj.pluralLabel,
      })
    );
  }

  const result: SObject[] = [obj];
  if (details && typeof details === "object") {
    for (const [detailName, detailDef] of Object.entries(details)) {
      result.push(...buildObjects(detailName, detailDef as Record<string, unknown>, file, obj));
    }
  }
  return result;
}

interface MasterDetailConfig {
  relationshipName?: string;
  relationshipLabel?: string;
  reparentableMasterDetail?: boolean;
  detailPlural?: string;
}

/** The MasterDetail field generated on a detail object that points to its master. */
function masterDetailField(master: SObject, cfg: MasterDetailConfig): Field {
  const relationshipName =
    cfg.relationshipName ?? sanitizeApiName(cfg.detailPlural) ?? sanitizeApiName(master.pluralLabel)!;
  const field: Field = {
    fullName: master.fullName,
    label: master.label,
    type: "MasterDetail",
    referenceTo: master.fullName,
    relationshipName,
    relationshipLabel: cfg.relationshipLabel ?? cfg.detailPlural ?? relationshipName,
  };
  if (cfg.reparentableMasterDetail !== undefined) {
    field.reparentableMasterDetail = cfg.reparentableMasterDetail;
  }
  return field;
}

/** Strip characters not valid in a Salesforce relationship/API name. */
function sanitizeApiName(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/[^A-Za-z0-9_]/g, "");
}

function toSObject(fullName: string, raw: any, file: string): SObject {
  const fieldsMap = raw.fields ?? {};
  const fields: Field[] = Object.entries(fieldsMap).map(([apiName, def]) =>
    toField(apiName, def as Record<string, unknown>)
  );
  const custom = isCustomObject(fullName);

  const obj: SObject = {
    fullName,
    label: raw.label,
    pluralLabel: raw.pluralLabel,
    description: raw.description,
    nameField: raw.nameField,
    fields,
  };

  // Standard objects only receive added custom fields — no object defaults or
  // object-meta.xml — so object-level settings apply to custom objects only.
  if (custom) {
    obj.sharingModel = raw.sharingModel ?? DEFAULT_SHARING_MODEL;
    obj.deploymentStatus = raw.deploymentStatus ?? DEFAULT_DEPLOYMENT_STATUS;

    // Auto-wire history tracking: if any field tracks history, the object must
    // enable it too (a deploy error otherwise). An explicit value wins.
    obj.enableHistory = raw.enableHistory ?? (fields.some((f) => f.trackHistory) || undefined);

    for (const toggle of OBJECT_FEATURE_TOGGLES) {
      if (raw[toggle] !== undefined) obj[toggle] = raw[toggle];
    }
  }

  return obj;
}

function toField(fullName: string, raw: any): Field {
  // The map key is the authoritative API name; carry the rest through verbatim
  // so the validator can enforce per-type rules on a complete object.
  const field: Field = { ...raw, fullName };

  // Translate the friendly picklist form `valueSet: { values: [...] }` into the
  // official `valueSet: { valueSetDefinition: { sorted, value: [...] } }` shape.
  if (raw.valueSet?.values && !raw.valueSet.valueSetDefinition) {
    field.valueSet = {
      restricted: raw.valueSet.restricted ?? true,
      valueSetDefinition: {
        sorted: raw.valueSet.sorted ?? false,
        value: raw.valueSet.values.map((v: any) => ({
          fullName: v.fullName,
          default: v.default ?? false,
          label: v.label ?? v.fullName,
        })),
      },
    };
  }

  return field;
}

/** Derive a default object filename for emit output. */
export function objectDirName(obj: SObject): string {
  return basename(obj.fullName);
}
