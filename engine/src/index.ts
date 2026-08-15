/**
 * Engine entry point.
 *
 * Two modules: the document contract, which defines the shape of a page, and
 * the compiler, which turns a page into host-correct Markdown.
 */
export const ENGINE_VERSION = "0.0.0";

export * from "./document/index.js";
export * from "./compile/index.js";
