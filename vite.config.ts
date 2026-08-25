import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

/**
 * Stamps the service worker with an identifier derived from the build output.
 *
 * The worker's cache name has to change when the app changes, or returning
 * visitors keep the old shell forever. A timestamp would do that and would also
 * make every build differ from the last for no reason, which this project cares
 * about elsewhere. Hashing the emitted asset filenames gives the same property
 * and stays reproducible: identical input, identical build id.
 */
function stampServiceWorker(): Plugin {
  return {
    name: "stamp-service-worker",
    closeBundle() {
      const dist = fileURLToPath(new URL("./app/dist", import.meta.url));
      const assets = readdirSync(`${dist}/assets`).sort().join("|");
      const id = createHash("sha256").update(assets).digest("hex").slice(0, 12);

      const swPath = `${dist}/sw.js`;
      const source = readFileSync(swPath, "utf8");
      writeFileSync(swPath, source.replace("__BUILD_ID__", id), "utf8");
      this.info?.(`service worker stamped with build id ${id}`);
    },
  };
}

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
  // Env files live beside .env.example at the project root, not under app/.
  // Without this they would have to sit in app/, which is not where
  // .env.example tells you to put them. Getting that wrong is silent: the
  // variable is simply undefined, so the upload button is not rendered, which
  // looks exactly like not having configured one at all.
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [stampServiceWorker()],
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
