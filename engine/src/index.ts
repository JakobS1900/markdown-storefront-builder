/**
 * Engine entry point.
 *
 * Deliberately near-empty. The constitution requires the `Document` schema to
 * land first and alone, in its own commit, with its parity test, before
 * anything consumes it. Nothing here may anticipate that shape.
 *
 * This module exists so Phase 0 can prove the toolchain end to end: build,
 * typecheck, lint, and test all run against real code before any feature work
 * begins.
 */
export const ENGINE_VERSION = "0.0.0";
