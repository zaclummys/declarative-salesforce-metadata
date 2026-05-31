#!/usr/bin/env node
import { Command } from "commander";
import { loadModel, ParseError } from "./parser.js";
import { validate } from "./validator.js";
import { emit } from "./emitter.js";
import { renderErd } from "./erd.js";
import { watchModel } from "./watch.js";
import { writeFileSync } from "node:fs";

const program = new Command();

program
  .name("dsfm")
  .description("Define Salesforce custom objects and fields declaratively in YAML.")
  .version("0.1.0");

program
  .command("validate")
  .description("Parse and validate the YAML model without writing output.")
  .argument("<input>", "model directory or single YAML file")
  .action((input: string) => {
    const model = load(input);
    const issues = validate(model);
    if (issues.length > 0) {
      for (const issue of issues) {
        console.error(`  ✗ ${issue.path}: ${issue.message}`);
      }
      console.error(`\n${issues.length} validation error(s).`);
      process.exit(1);
    }
    const fieldCount = model.objects.reduce((n, o) => n + o.fields.length, 0);
    console.log(`✓ valid: ${model.objects.length} object(s), ${fieldCount} field(s).`);
  });

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

program
  .command("erd")
  .description("Render the model as a Mermaid entity-relationship diagram.")
  .argument("<input>", "model directory or single YAML file")
  .option("-o, --out <file>", "write the diagram to a file instead of stdout")
  .action((input: string, opts: { out?: string }) => {
    const diagram = renderErd(load(input));
    if (opts.out) {
      writeFileSync(opts.out, diagram);
      console.log(`✓ wrote diagram to ${opts.out}`);
    } else {
      process.stdout.write(diagram);
    }
  });

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

function load(input: string) {
  try {
    return loadModel(input);
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

program.parseAsync();
