import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@mdsb/engine": fileURLToPath(new URL("./engine/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["engine/tests/**/*.test.ts", "app/tests/**/*.test.ts", "proxy/tests/**/*.test.ts"],
  },
});
