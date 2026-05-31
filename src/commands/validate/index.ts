import type { Command } from "commander";
import { validate } from "../../validator.js";
import { load } from "../shared.js";

export function registerValidate(program: Command): void {
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
}
