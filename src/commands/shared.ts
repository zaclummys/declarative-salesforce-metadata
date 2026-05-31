import { loadModel, ParseError } from "@/parser.js";

/**
 * Load a model from a path, printing parse errors and exiting non-zero. For
 * read-only commands (validate, erd) that should abort the process on a bad
 * model; `generate` handles errors itself so it can keep watching.
 */
export function load(input: string) {
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
