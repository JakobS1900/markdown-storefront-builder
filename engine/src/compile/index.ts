/**
 * The public surface of the compiler.
 *
 * Target records are exported because the app needs them for the host switcher:
 * it must show a name for each host and know which identifiers exist. The
 * emitters and the escaper are not exported, because nothing outside this
 * module should be producing Markdown by hand.
 */
export { compile } from "./compile.js";

/**
 * Exported so the editor can warn about an address BEFORE compiling, using the
 * same definition of safe that the compiler enforces.
 *
 * If the app had its own copy of this check the two could disagree, and the
 * failure would be the app telling an artist their image is fine while the
 * compiler silently drops it. One definition, one answer.
 */
export { isSafeUrl } from "./link.js";
export { TARGETS, PORTABLE, RENTRY, TEXT_IS, FALLBACK_TARGET, findTarget } from "./targets.js";
export type { Capabilities, Target } from "./capabilities.js";
export type {
  CompileDiagnostic,
  CompileResult,
  DiagnosticCode,
  DiagnosticSeverity,
} from "./diagnostics.js";
