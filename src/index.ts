#!/usr/bin/env node
import { Command } from "commander";
import { loadModel, ParseError } from "./parser.js";
import { validate } from "./validator.js";
import { emit } from "./emitter.js";
import { renderErd, fetchErdImage, type ErdFormat } from "./erd.js";
import { readSource, combinedYaml, splitYaml } from "./converter.js";
import { watchModel } from "./watch.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
