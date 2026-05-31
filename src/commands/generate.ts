import type { Command } from "commander";
import { loadModel, ParseError } from "../parser.js";
import { validate } from "../validator.js";
import { emit } from "../emitter.js";
import { watchModel } from "../watch.js";

export function registerGenerate(program: Command): void {
  program
    .command("generate")
    .description("Generate Salesforce source XML from the YAML model.")
    .argument("<input>", "model directory or single YAML file")
    .option("-o, --out <dir>", "output source root", "force-app/main/default")
    .option("-w, --watch", "regenerate whenever the model changes")
    .action((input: string, opts: { out: string; watch?: boolean }) => {
      const ok = generateOnce(input, opts.out);

      if (!opts.watch) {
        if (!ok) process.exit(1);
        return;
      }

      // Watch mode: never exit on error — print and keep watching so the user can
      // fix the model and see the next run succeed.
      console.log(`\n👀 watching ${input} for changes (press ctrl-c to stop)…`);
      const stop = watchModel(input, () => {
        console.log("\n↻ change detected, regenerating…");
        generateOnce(input, opts.out);
      });
      const shutdown = () => {
        stop();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}

/**
 * Run the full generate pipeline once, printing results. Returns whether it
 * succeeded; never exits the process, so it is safe to call repeatedly in watch
 * mode.
 */
function generateOnce(input: string, out: string): boolean {
  let model;
  try {
    model = loadModel(input);
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`✗ ${err.message}`);
      return false;
    }
    throw err;
  }

  const issues = validate(model);
  if (issues.length > 0) {
    for (const issue of issues) console.error(`  ✗ ${issue.path}: ${issue.message}`);
    console.error(`\n${issues.length} validation error(s); aborting.`);
    return false;
  }

  const { files } = emit(model, out);
  console.log(`✓ wrote ${files.length} file(s) under ${out}`);
  return true;
}
