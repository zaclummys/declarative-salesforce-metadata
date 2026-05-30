import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { isCustomObject, OBJECT_FEATURE_TOGGLES, type Field, type GlobalValueSet, type Model, type RecordType, type SObject } from "./model.js";

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
 *  - a single YAML file, or
 *  - a directory, in which case **all** `.yaml`/`.yml` files under it
 *    (recursively) are loaded and merged into one model.
 *
 * Each file is either a single-object file (top-level `fullName`) or a
 * multi-object file (top-level `objects:` map); both forms may be mixed within
 * a directory.
 */
export function loadModel(inputPath: string): Model {
  if (!existsSync(inputPath)) {
    throw new ParseError(`path does not exist: ${inputPath}`);
  }

  const files = statSync(inputPath).isDirectory() ? yamlFilesIn(inputPath) : [inputPath];
  if (files.length === 0) {
    throw new ParseError(`no .yaml files found in ${inputPath}`);
  }

  const parsed = files.map(parseFile);
  return {
    objects: parsed.flatMap((p) => p.objects),
    globalValueSets: parsed.flatMap((p) => p.globalValueSets),
  };
}

/** Recursively collect every `.yaml`/`.yml` file under a directory, sorted. */
function yamlFilesIn(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...yamlFilesIn(full));
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      files.push(full);
    }
  }
  return files.sort();
}

interface ParsedFile {
  objects: SObject[];
  globalValueSets: GlobalValueSet[];
}

/** Parse one model file, accepting any supported top-level form. */
function parseFile(file: string): ParsedFile {
  const raw = parseYaml(readFileSync(file, "utf8")) ?? {};
  if (typeof raw !== "object") {
    throw new ParseError("expected a mapping at the top level", file);
  }

  // `globalValueSets:` may appear on its own or alongside objects in any file.
  const globalValueSets: GlobalValueSet[] =
    raw.globalValueSets && typeof raw.globalValueSets === "object"
      ? Object.entries(raw.globalValueSets).map(([name, def]) =>
          toGlobalValueSet(name, def as Record<string, unknown>)
        )
      : [];

  let objects: SObject[] = [];
  if (raw.objects && typeof raw.objects === "object") {
    // Multi-object file: a top-level `objects:` map keyed by API name.
    objects = Object.entries(raw.objects).flatMap(([apiName, def]) =>
      buildObjects(apiName, def as Record<string, unknown>, file)
    );
  } else if (raw.fullName) {
    // Single-object file: the object is the document, keyed by `fullName`.
    objects = buildObjects(raw.fullName, raw, file);
  } else if (globalValueSets.length === 0) {
    throw new ParseError(
      "file must have a top-level `objects:` map, a `fullName`, or `globalValueSets:`",
      file
    );
  }

  return { objects, globalValueSets };
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

  // A detail in a master-detail relationship inherits sharing from its master:
  // Salesforce requires its sharingModel to be `ControlledByParent` (and rejects
  // any other value). Applies whether the MasterDetail field was authored
  // explicitly or synthesized from nesting.
  if (obj.fields.some((f) => f.type === "MasterDetail")) {
    obj.sharingModel = "ControlledByParent";
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

  if (raw.recordTypes && typeof raw.recordTypes === "object") {
    obj.recordTypes = Object.entries(raw.recordTypes).map(([rtName, def]) =>
      toRecordType(rtName, def as Record<string, unknown>)
    );
  }

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

/**
 * Translate the friendly record-type form into the official `RecordType` shape.
 * `active` defaults to true. Each `picklists:` entry restricts which values are
 * available for the record type; the first value listed becomes its default.
 */
function toRecordType(fullName: string, raw: any): RecordType {
  const rt: RecordType = {
    fullName,
    label: raw.label ?? fullName,
    active: raw.active ?? true,
  };
  if (raw.description !== undefined) rt.description = raw.description;

  if (raw.picklists && typeof raw.picklists === "object") {
    rt.picklistValues = Object.entries(raw.picklists).map(([picklist, values]) => ({
      picklist,
      values: (values as string[]).map((value, i) => ({
        fullName: value,
        default: i === 0,
      })),
    }));
  }

  return rt;
}

/**
 * Translate the friendly global-value-set form into the official `GlobalValueSet`
 * shape: `label` becomes `masterLabel`, and the `values:` list becomes
 * `customValue[]` (same friendly authoring as an inline picklist).
 */
function toGlobalValueSet(fullName: string, raw: any): GlobalValueSet {
  const gvs: GlobalValueSet = {
    fullName,
    masterLabel: raw.label ?? raw.masterLabel ?? fullName,
    sorted: raw.sorted ?? false,
  };
  if (raw.description !== undefined) gvs.description = raw.description;

  const values = raw.values ?? [];
  gvs.customValue = values.map((v: any) => ({
    fullName: v.fullName,
    default: v.default ?? false,
    label: v.label ?? v.fullName,
  }));

  return gvs;
}

/** Derive a default object filename for emit output. */
export function objectDirName(obj: SObject): string {
  return basename(obj.fullName);
}
