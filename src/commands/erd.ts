import type { Command } from "commander";
import { writeFileSync } from "node:fs";
import { renderErd, fetchErdImage, type ErdFormat } from "../erd.js";
import { load } from "./shared.js";

export function registerErd(program: Command): void {
  program
    .command("erd")
    .description("Render the model as a Mermaid entity-relationship diagram.")
    .argument("<input>", "model directory or single YAML file")
    .option("-o, --out <file>", "write to a file instead of stdout")
    .option(
      "-f, --format <format>",
      "mmd (Mermaid text), svg, or png; inferred from --out extension if omitted"
    )
    .action(async (input: string, opts: { out?: string; format?: string }) => {
      const format = resolveErdFormat(opts.format, opts.out);
      const model = load(input);

      if (format === "mmd") {
        const diagram = renderErd(model);
        if (opts.out) {
          writeFileSync(opts.out, diagram);
          console.log(`✓ wrote diagram to ${opts.out}`);
        } else {
          process.stdout.write(diagram);
        }
        return;
      }

      // svg/png are rendered remotely (binary); require --out so we don't dump
      // bytes onto a terminal, and so the user gets a clear destination.
      if (!opts.out) {
        console.error("✗ --out <file> is required when --format is svg or png");
        process.exit(1);
      }
      let image;
      try {
        image = await fetchErdImage(model, format);
      } catch (err) {
        const cause = (err as { cause?: { code?: string } }).cause;
        console.error(`✗ could not render ${format} via mermaid.ink: ${(err as Error).message}`);
        if (cause?.code) console.error(`  cause: ${cause.code}`);
        // A TLS chain error usually means a corporate proxy whose root CA Node
        // doesn't trust by default — point at the system keychain.
        if (cause?.code?.includes("CERT") || cause?.code?.includes("ISSUER")) {
          console.error("  hint: behind a TLS-inspecting proxy? retry with NODE_OPTIONS=--use-system-ca");
        }
        process.exit(1);
      }
      writeFileSync(opts.out, image);
      console.log(`✓ wrote diagram to ${opts.out}`);
    });
}

/**
 * Resolve the erd output format. An explicit `--format` wins; otherwise infer
 * from the `--out` extension (`.svg`/`.png`), defaulting to Mermaid text.
 */
function resolveErdFormat(format: string | undefined, out: string | undefined): ErdFormat {
  if (format) {
    if (format === "mmd" || format === "svg" || format === "png") return format;
    console.error(`✗ unknown --format '${format}' (expected mmd, svg, or png)`);
    process.exit(1);
  }
  if (out?.endsWith(".svg")) return "svg";
  if (out?.endsWith(".png")) return "png";
  return "mmd";
}
