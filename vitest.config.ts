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
    // Pinned so the upload control is always built, and always tested.
    //
    // Without this the tests inherit whatever Client-ID the machine happens to
    // have: a contributor with a .env.local exercises the upload path, CI does
    // not, and the same commit is checked differently in the two places. That
    // is not hypothetical. It is how an unlabelled file input survived the a11y
    // gate, which cannot fail a control it never renders.
    //
    // A fixed fake value is correct here. No test performs a real upload, and
    // the only thing this switches on is whether the control exists.
    env: { VITE_IMGUR_CLIENT_ID: "test-client-id-not-used-for-real-uploads" },
  },
});
