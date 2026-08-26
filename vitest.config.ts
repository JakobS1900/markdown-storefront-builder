import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@mdsb/engine": fileURLToPath(new URL("./engine/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["engine/tests/**/*.test.ts", "app/tests/**/*.test.ts"],
    // No VITE_IMGUR_CLIENT_ID pin here, deliberately, and it is worth saying
    // why so nobody adds one back.
    //
    // Pinning it in this file does not work: a .env.local takes precedence
    // over `test.env`, so the value silently depends on the machine anyway.
    // Emptying .env.local turned the a11y gate's upload assertions back off
    // without failing anything, which is the same class of bug twice.
    //
    // Tests that care now mock ../src/upload.js and state which build they are
    // checking. That is deterministic everywhere and readable in the test.
  },
});
