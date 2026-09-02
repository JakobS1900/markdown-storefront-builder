import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "temp/**",
      // Capacitor generates the native bridge and copies our built assets in.
      // Neither is ours to lint, and rewriting either would be undone by the
      // next `cap sync`.
      "android/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Promoted to errors: these are the categories that cause real defects
      // rather than style disagreements.
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "no-implicit-coercion": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Constitution Principle I: the engine is a pure function. No DOM, no
    // network, no clock, no randomness. Enforced here so a violation fails
    // lint rather than being caught by review, or not at all.
    files: ["engine/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "document", message: "Principle I: the engine must not touch the DOM." },
        { name: "window", message: "Principle I: the engine must not touch the DOM." },
        { name: "fetch", message: "Principle I: the engine must not perform network I/O." },
        { name: "crypto", message: "Principle I: the engine must not consume randomness." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Principle I: the engine must not read a clock." },
        { object: "Math", property: "random", message: "Principle I: the engine must not consume randomness." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Principle I: the engine must not read a clock.",
        },
      ],
    },
  },
  {
    // Non-null assertions stay forbidden in engine/src, where one can hide a
    // real null from a real user at runtime. In tests the assertion is made
    // against a fixture the test itself built, and a wrong one fails that test
    // immediately and visibly. The rule buys nothing there and costs a lot of
    // noise, given `noUncheckedIndexedAccess` makes every array index optional.
    files: ["engine/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // The service worker runs in its own global scope, which has neither the
    // window globals nor the Node ones. It ships to the browser verbatim from
    // public/, so it is plain JavaScript rather than TypeScript.
    files: ["app/public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Promise: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        // The contrast gate drives a real browser over the debugging protocol,
        // so it needs the timer, fetch and socket globals Node has had since 18.
        setTimeout: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        WebSocket: "readonly",
      },
    },
    rules: {
      // These scripts are the build gates. Reporting to the console is their job.
      "no-console": "off",
    },
  },
);
