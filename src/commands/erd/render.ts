/**
 * Render a model as a Mermaid entity-relationship diagram. Each object becomes
 * an entity with its fields as attributes; each Lookup / MasterDetail field
 * becomes a relationship edge to the referenced object.
 *
 * Cardinality is drawn parent-to-child (the referenced object is the "one" end,
 * the object declaring the field is the "many" end). Master-detail uses a solid
 * identifying line, lookup a dashed non-identifying line — matching how
 * Salesforce treats the two:
 *
 *   Parent ||--o{ Child : relationship   (MasterDetail — identifying)
 *   Parent ||..o{ Child : relationship   (Lookup — non-identifying)
 */
import type { Field, Model, SObject } from "../../model.js";

interface Relationship {
  parent: string;
  child: string;
  label: string;
  identifying: boolean;
}

export function renderErd(model: Model): string {
  const lines: string[] = ["erDiagram"];

  // Objects referenced by a relationship but not defined in the model (e.g. the
  // standard `Account`) still get an entity block so their edges render; track
  // every name we want to draw and emit attribute blocks only for those we have.
  const defined = new Map(model.objects.map((o) => [o.fullName, o]));
  const relationships: Relationship[] = [];
  const referenced = new Set<string>();

  for (const obj of model.objects) {
    for (const field of obj.fields) {
      if (field.type !== "Lookup" && field.type !== "MasterDetail") continue;
      const parent = field.referenceTo;
      if (!parent) continue;
      relationships.push({
        parent,
        child: obj.fullName,
        label: field.relationshipName ?? field.fullName,
        identifying: field.type === "MasterDetail",
      });
      referenced.add(parent);
    }
  }

  // Entity blocks: every defined object, plus a bare block for referenced
  // objects we don't define so they appear as named entities.
  for (const obj of model.objects) {
    lines.push(...entityBlock(obj));
  }
  for (const name of referenced) {
    if (!defined.has(name)) lines.push(`  ${entityName(name)} {`, "  }");
  }

  for (const rel of relationships) {
    const line = rel.identifying ? "||--o{" : "||..o{";
    lines.push(`  ${entityName(rel.parent)} ${line} ${entityName(rel.child)} : ${quoteLabel(rel.label)}`);
  }

  return lines.join("\n") + "\n";
}

function entityBlock(obj: SObject): string[] {
  const out = [`  ${entityName(obj.fullName)} {`];
  if (obj.nameField) {
    out.push(`    ${attrType(obj.nameField.type)} ${attrName(obj.nameField.fullName)} PK`);
  }
  for (const field of obj.fields) {
    const key = field.type === "Lookup" || field.type === "MasterDetail" ? " FK" : "";
    out.push(`    ${attrType(field.type)} ${attrName(field.fullName)}${key}`);
  }
  out.push("  }");
  return out;
}

/** Entity names allow letters, digits and underscores — Salesforce API names already conform. */
function entityName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}

/** Mermaid attribute types and names must be single bare tokens. */
function attrType(type: Field["type"]): string {
  return String(type).replace(/[^A-Za-z0-9_]/g, "_");
}

function attrName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}

/** Quote relationship labels so names with spaces survive. */
function quoteLabel(label: string): string {
  return `"${label.replace(/"/g, "")}"`;
}

export type ErdFormat = "mmd" | "svg" | "png";

/**
 * Render the diagram to an image by delegating to the public mermaid.ink
 * service: the diagram source is base64url-encoded into the request path and
 * the rendered bytes come back in the response. Note this sends the model's
 * object and field names to a third-party host; use `mmd` (text) for offline
 * or private models.
 */
export async function fetchErdImage(model: Model, format: "svg" | "png"): Promise<Buffer> {
  const encoded = Buffer.from(renderErd(model), "utf8").toString("base64url");
  // mermaid.ink serves vector from /svg and raster from /img; /img defaults to
  // JPEG, so request PNG explicitly with `?type=png`.
  const url =
    format === "svg"
      ? `https://mermaid.ink/svg/${encoded}`
      : `https://mermaid.ink/img/${encoded}?type=png`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`mermaid.ink returned ${res.status} ${res.statusText} for ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
