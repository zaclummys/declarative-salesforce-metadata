#!/usr/bin/env node
import { Command } from "commander";
import { registerValidate } from "./commands/validate.js";
import { registerGenerate } from "./commands/generate.js";
import { registerErd } from "./commands/erd.js";
import { registerConvert } from "./commands/convert.js";

const program = new Command();

program
  .name("dsfm")
  .description("Define Salesforce custom objects and fields declaratively in YAML.")
  .version("0.1.0");

registerValidate(program);
registerGenerate(program);
registerErd(program);
registerConvert(program);

program.parseAsync();
