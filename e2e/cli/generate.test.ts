import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Run the CLI as a subprocess, exactly as a user would. */
function dsfm(args: string[]) {
  const result = spawnSync("npx", ["tsx", "src/index.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

let outDir: string;
beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "dsfm-e2e-"));
});
afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("dsfm validate", () => {
  it("accepts a valid model", () => {
    const r = dsfm(["validate", "examples"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("valid");
  });

  it("rejects an invalid model with a non-zero exit", () => {
    const r = dsfm(["validate", "examples/does-not-exist.yaml"]);
    expect(r.status).not.toBe(0);
  });
});

describe("dsfm generate — filesystem output", () => {
  it("writes the expected source tree for the Invoice example", () => {
    const dest = join(outDir, "invoice");
    const r = dsfm(["generate", "examples", "-o", dest]);
    expect(r.status).toBe(0);

    const objDir = join(dest, "objects", "Invoice__c");
    expect(existsSync(join(objDir, "Invoice__c.object-meta.xml"))).toBe(true);
    for (const f of ["Amount__c", "Status__c", "Account__c"]) {
      expect(existsSync(join(objDir, "fields", `${f}.field-meta.xml`))).toBe(true);
    }

    // Object XML omits its own fullName (folder carries the API name in source
    // format) — though the nested nameField keeps its fullName.
    const objXml = readFileSync(join(objDir, "Invoice__c.object-meta.xml"), "utf8");
    expect(objXml).toContain("<CustomObject");
    expect(objXml).not.toContain("<fullName>Invoice__c</fullName>");
    expect(objXml).not.toContain("<enableHistory>"); // no tracked fields here

    // Picklist expands into the official nested shape.
    const statusXml = readFileSync(join(objDir, "fields", "Status__c.field-meta.xml"), "utf8");
    expect(statusXml).toContain("<type>Picklist</type>");
    expect(statusXml).toContain("<valueSetDefinition>");
  });

  it("auto-wires enableHistory when a field tracks history", () => {
    const dest = join(outDir, "history");
    const r = dsfm(["generate", "examples/history-tracking.yaml", "-o", dest]);
    expect(r.status).toBe(0);

    const objDir = join(dest, "objects", "Support_Case__c");
    const objXml = readFileSync(join(objDir, "Support_Case__c.object-meta.xml"), "utf8");
    expect(objXml).toContain("<enableHistory>true</enableHistory>");

    const statusXml = readFileSync(join(objDir, "fields", "Status__c.field-meta.xml"), "utf8");
    expect(statusXml).toContain("<trackHistory>true</trackHistory>");
  });

  it("generates an auto MasterDetail field from nested details", () => {
    const dest = join(outDir, "nested");
    const r = dsfm(["generate", "examples/nested-details.yaml", "-o", dest]);
    expect(r.status).toBe(0);

    const mdPath = join(dest, "objects", "Project_Task__c", "fields", "Project__c.field-meta.xml");
    expect(existsSync(mdPath)).toBe(true);
    const mdXml = readFileSync(mdPath, "utf8");
    expect(mdXml).toContain("<type>MasterDetail</type>");
    expect(mdXml).toContain("<referenceTo>Project__c</referenceTo>");
    expect(mdXml).toContain("<relationshipName>Tasks</relationshipName>");
  });

  it("merges every YAML file in a directory into one model", () => {
    const dest = join(outDir, "all");
    const r = dsfm(["generate", "examples", "-o", dest]);
    expect(r.status).toBe(0);

    // Objects come from different files across the examples directory.
    const objects = join(dest, "objects");
    for (const obj of ["Invoice__c", "Order__c", "Project__c", "Account"]) {
      expect(existsSync(join(objects, obj))).toBe(true);
    }
  });

  it("passes object feature toggles through to the object XML", () => {
    const dest = join(outDir, "features");
    const r = dsfm(["generate", "examples/object-features.yaml", "-o", dest]);
    expect(r.status).toBe(0);

    const objXml = readFileSync(
      join(dest, "objects", "Equipment__c", "Equipment__c.object-meta.xml"),
      "utf8"
    );
    expect(objXml).toContain("<enableReports>true</enableReports>");
    expect(objXml).toContain("<enableActivities>true</enableActivities>");
    expect(objXml).toContain("<enableSearch>true</enableSearch>");
  });

  it("emits record types into a recordTypes/ subfolder", () => {
    const dest = join(outDir, "recordtypes");
    const r = dsfm(["generate", "examples/record-types.yaml", "-o", dest]);
    expect(r.status).toBe(0);

    const objDir = join(dest, "objects", "Account__c");
    const rtPath = join(objDir, "recordTypes", "Enterprise.recordType-meta.xml");
    expect(existsSync(rtPath)).toBe(true);

    const rtXml = readFileSync(rtPath, "utf8");
    expect(rtXml).toContain("<RecordType");
    expect(rtXml).toContain("<active>true</active>");
    expect(rtXml).toContain("<picklist>Segment__c</picklist>");
    // First value listed becomes the record type's default.
    expect(rtXml).toContain("<fullName>Enterprise</fullName>");

    // Record types are decomposed children — never inlined into the object XML.
    const objXml = readFileSync(join(objDir, "Account__c.object-meta.xml"), "utf8");
    expect(objXml).not.toContain("<recordTypes>");
  });

  it("emits only fields for a standard object (no object-meta.xml)", () => {
    const dest = join(outDir, "standard");
    const r = dsfm(["generate", "examples/standard-object.yaml", "-o", dest]);
    expect(r.status).toBe(0);

    const objDir = join(dest, "objects", "Account");
    expect(existsSync(join(objDir, "Account.object-meta.xml"))).toBe(false);
    expect(existsSync(join(objDir, "fields", "Health_Score__c.field-meta.xml"))).toBe(true);
    expect(existsSync(join(objDir, "fields", "Account_Tier__c.field-meta.xml"))).toBe(true);
  });
});
