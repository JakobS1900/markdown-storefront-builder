import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

/**
 * The app is a static site. No server, no bundler magic beyond what is needed
 * to ship TypeScript and a service worker to a browser.
 *
 * The engine is aliased to its source rather than its build output so a change
 * there is picked up immediately during development, and so the two are always
 * typechecked as one program.
 */
export default defineConfig({
  root: fileURLToPath(new URL("./app", import.meta.url)),
  base: "./",
  resolve: {
    alias: {
      "@mdsb/engine": fileURLToPath(new URL("./engine/src/index.ts", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./app/dist", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
  },
});
