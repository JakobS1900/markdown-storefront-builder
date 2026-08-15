/**
 * The public surface of the compiler.
 *
 * Target records are exported because the app needs them for the host switcher:
 * it must show a name for each host and know which identifiers exist. The
 * emitters and the escaper are not exported, because nothing outside this
 * module should be producing Markdown by hand.
 */
export { compile } from "./compile.js";
export { TARGETS, PORTABLE, RENTRY, FALLBACK_TARGET, findTarget } from "./targets.js";
export type { Capabilities, Target } from "./capabilities.js";
export type {
  CompileDiagnostic,
  CompileResult,
  DiagnosticCode,
  DiagnosticSeverity,
} from "./diagnostics.js";
