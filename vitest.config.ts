import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "e2e/cli/**/*.test.ts"],
    // CLI e2e tests spawn the CLI as a subprocess, which takes longer than a
    // unit test, so give them headroom.
    testTimeout: 30_000,
  },
});
