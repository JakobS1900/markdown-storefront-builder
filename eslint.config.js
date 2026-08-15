import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "temp/**"],
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
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      // These scripts are the build gates. Reporting to the console is their job.
      "no-console": "off",
    },
  },
);
