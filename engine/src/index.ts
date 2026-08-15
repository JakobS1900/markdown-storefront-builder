/**
 * Engine entry point.
 *
 * The document contract is the whole engine for now. The compiler, the target
 * records, and the emitters arrive in roadmap item 1.2 and later, and will be
 * re-exported alongside it from here.
 */
export const ENGINE_VERSION = "0.0.0";

export * from "./document/index.js";
