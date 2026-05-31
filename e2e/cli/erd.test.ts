import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
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
  outDir = mkdtempSync(join(tmpdir(), "dsfm-erd-"));
});
afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("dsfm erd", () => {
  it("renders a Mermaid diagram to stdout", () => {
    const r = dsfm(["erd", "examples/single-object.yaml"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("erDiagram");

    // The Invoice object and its fields become an entity block.
    expect(r.stdout).toContain("Invoice__c {");
    expect(r.stdout).toContain("Currency Amount__c");
    expect(r.stdout).toContain("AutoNumber Name PK");
    expect(r.stdout).toContain("Lookup Account__c FK");

    // A lookup is a dashed (non-identifying) edge, parent to child.
    expect(r.stdout).toContain('Account ||..o{ Invoice__c : "Invoices"');
  });

  it("draws master-detail as a solid identifying edge", () => {
    const r = dsfm(["erd", "examples/nested-details.yaml"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Project__c ||--o{ Project_Task__c : "Tasks"');
  });

  it("writes the diagram to a file with --out", () => {
    const dest = join(outDir, "erd.md");
    const r = dsfm(["erd", "examples/single-object.yaml", "-o", dest]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(dest);
    expect(readFileSync(dest, "utf8")).toContain("erDiagram");
  });

  it("exits non-zero on an invalid path", () => {
    const r = dsfm(["erd", "examples/does-not-exist.yaml"]);
    expect(r.status).not.toBe(0);
  });

  it("rejects an unknown --format", () => {
    const r = dsfm(["erd", "examples/single-object.yaml", "-f", "gif"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("unknown --format");
  });

  it("requires --out for image formats", () => {
    const r = dsfm(["erd", "examples/single-object.yaml", "-f", "png"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("--out");
  });
});
