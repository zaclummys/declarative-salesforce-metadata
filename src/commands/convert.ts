import type { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ParseError } from "../parser.js";
import { readSource, combinedYaml, splitYaml } from "../converter.js";

export function registerConvert(program: Command): void {
  program
    .command("convert")
    .description("Convert a Salesforce source tree into a YAML model (inverse of generate).")
    .argument("<source>", "source root (e.g. force-app/main/default) or its objects/ dir")
    .option("-o, --out <dir>", "write one YAML file per object into this directory instead of stdout")
    .action((source: string, opts: { out?: string }) => {
      let model;
      try {
        model = readSource(source);
      } catch (err) {
        if (err instanceof ParseError) {
          console.error(`✗ ${err.message}`);
          process.exit(1);
        }
        throw err;
      }

      if (!opts.out) {
        process.stdout.write(combinedYaml(model));
        return;
      }

      mkdirSync(opts.out, { recursive: true });
      const files = splitYaml(model);
      for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(opts.out, name), content);
      }
      console.log(`✓ wrote ${Object.keys(files).length} file(s) under ${opts.out}`);
    });
}
