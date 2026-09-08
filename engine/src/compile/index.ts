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
export { isSafeUrl, isSafeLinkUrl } from "./link.js";

/**
 * The words the Availability column publishes, for the same reason `isSafeUrl`
 * is exported: so the editor and the compiler cannot disagree.
 *
 * This is not an emitter and does not let anyone produce Markdown by hand. It
 * is one map from the contract's four values to the four phrases that reach a
 * reader. The dropdown a seller chooses from is built out of it, so choosing
 * "Sold out" and reading "Sold out" on the page is a property of there being
 * one list rather than of two lists having been checked against each other.
 *
 * Keyed by the enum, so a fifth value added to the contract fails to compile
 * here until somebody decides what it says.
 */
export { SELLING_MODE_WORDS } from "./emit/menu.js";
export {
  TARGETS,
  ALL_TARGETS,
  PORTABLE,
  RENTRY,
  TEXT_IS,
  MENU_FILE,
  FALLBACK_TARGET,
  findTarget,
} from "./targets.js";
export type { Capabilities, Target } from "./capabilities.js";
export type {
  CompileDiagnostic,
  CompileResult,
  DiagnosticCode,
  DiagnosticSeverity,
} from "./diagnostics.js";
