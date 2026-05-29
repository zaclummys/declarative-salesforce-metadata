import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const MODEL = `objects:
  Widget__c:
    label: Widget
    pluralLabel: Widgets
    nameField:
      fullName: Name
      label: Name
      type: Text
    fields:
      Qty__c:
        label: Quantity
        type: Number
        precision: 18
        scale: 0
`;

const ADDED_FIELD = `      Color__c:
        label: Color
        type: Text
        length: 40
`;

async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(100);
  }
  return predicate();
}

describe("dsfm generate --watch", () => {
  it("regenerates when the model changes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dsfm-watch-"));
    const modelPath = join(dir, "model.yaml");
    const outDir = join(dir, "out");
    writeFileSync(modelPath, MODEL);

    const child = spawn("npx", ["tsx", "src/index.ts", "generate", modelPath, "-o", outDir, "--watch"], {
      cwd: repoRoot,
    });

    const fieldsDir = join(outDir, "objects", "Widget__c", "fields");
    try {
      // Initial generation.
      const initial = await waitFor(() => existsSync(join(fieldsDir, "Qty__c.field-meta.xml")));
      expect(initial).toBe(true);

      // Edit the model; the watcher should pick it up and regenerate.
      appendFileSync(modelPath, ADDED_FIELD);
      const regenerated = await waitFor(() => existsSync(join(fieldsDir, "Color__c.field-meta.xml")));
      expect(regenerated).toBe(true);
    } finally {
      child.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
