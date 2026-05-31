import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
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

/** Map of every file under `dir` (relative path → contents), for tree comparison. */
function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(dir, full)] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

let outDir: string;
beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "dsfm-convert-"));
});
afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("dsfm convert", () => {
  it("emits YAML to stdout", () => {
    const src = join(outDir, "src0");
    expect(dsfm(["generate", "examples", "-o", src]).status).toBe(0);

    const r = dsfm(["convert", src]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("objects:");
    // Friendly forms are restored, not the raw Metadata API shape.
    expect(r.stdout).toContain("valueSet:");
    expect(r.stdout).not.toContain("valueSetDefinition");
    expect(r.stdout).not.toContain("masterLabel");
  });

  it("round-trips: generate → convert → generate produces an identical source tree", () => {
    const src1 = join(outDir, "src1");
    const yaml = join(outDir, "yaml");
    const src2 = join(outDir, "src2");

    expect(dsfm(["generate", "examples", "-o", src1]).status).toBe(0);
    expect(dsfm(["convert", src1, "-o", yaml]).status).toBe(0);
    expect(dsfm(["generate", yaml, "-o", src2]).status).toBe(0);

    expect(readTree(src2)).toEqual(readTree(src1));
  });

  it("converted YAML passes validation", () => {
    const src = join(outDir, "src3");
    const yaml = join(outDir, "yaml3");
    expect(dsfm(["generate", "examples", "-o", src]).status).toBe(0);
    expect(dsfm(["convert", src, "-o", yaml]).status).toBe(0);

    const r = dsfm(["validate", yaml]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("valid");
  });

  it("accepts the objects/ directory directly", () => {
    const src = join(outDir, "src4");
    expect(dsfm(["generate", "examples", "-o", src]).status).toBe(0);

    const r = dsfm(["convert", join(src, "objects")]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("objects:");
  });

  it("exits non-zero on a missing source", () => {
    const r = dsfm(["convert", join(outDir, "does-not-exist")]);
    expect(r.status).not.toBe(0);
  });
});
