/**
 * The compiler entry point.
 *
 * Takes a validated page and a host identifier, returns Markdown plus every
 * compromise made along the way.
 *
 * Pure, per constitution Principle I. No DOM, no network, no clock, no
 * randomness, and it never throws for a valid page and any identifier at all
 * (FR-002). The same page and host always produce identical bytes, which is
 * what makes the golden files a real guarantee rather than a habit.
 *
 * It does not re-validate. Validation is feature 001's job, and doing it in two
 * places creates two things that can disagree about what a valid page is.
 */
import type { Block, Document } from "../document/types.js";
import type { Target } from "./capabilities.js";
import { DiagnosticSink, type CompileResult } from "./diagnostics.js";
import { emitDivider } from "./emit/divider.js";
import { emitGallery } from "./emit/gallery.js";
import { emitHeading } from "./emit/heading.js";
import { emitMenu } from "./emit/menu.js";
import { emitProfile } from "./emit/profile.js";
import { emitProse } from "./emit/prose.js";
import { FALLBACK_TARGET, findTarget } from "./targets.js";

/**
 * Emits one block.
 *
 * Every kind the descriptor declares is handled and there is no default branch,
 * so adding a kind to the contract without writing its emitter fails to compile
 * rather than silently producing a page with a section missing.
 *
 * An emitter may return an empty string, which the caller drops. That happens
 * when a section has nothing in it yet, for instance a gallery with no images.
 * FR-007: an empty collection produces no output rather than an empty table.
 */
function emitBlock(block: Block, target: Target, sink: DiagnosticSink): string {
  switch (block.kind) {
    case "heading":
      return emitHeading(block, target, sink);
    case "divider":
      return emitDivider(target);
    case "prose":
      return emitProse(block, target);
    case "menu":
      return emitMenu(block, target, sink);
    case "gallery":
      return emitGallery(block, target, sink);
    case "profile":
      return emitProfile(block, target, sink);
  }
}

/**
 * Compiles a page for a host.
 *
 * An unrecognised host falls back to the portable baseline and warns rather
 * than refusing (FR-008). Feature 001 stores `target` as an opaque string
 * precisely so adding a host needs no contract change, which means a page can
 * legitimately name a host this build has never heard of. Refusing would make
 * that page unopenable, which is the outcome feature 001's review rejected.
 */
export function compile(doc: Document, target: string | Target): CompileResult {
  const sink = new DiagnosticSink();

  return compileForTarget(doc, target, sink);
}

/**
 * Accepts a target object as well as an identifier.
 *
 * A `Target` passed directly is used as given, with no registry lookup and no
 * fallback, because the caller has handed us the host rather than named it.
 *
 * This is what makes SC-007 checkable through the real code path: a test can
 * invent a throwaway host and compile with it, and if that works then hosts
 * really are data. An earlier draft of the test rebuilt the compiler inside
 * itself to achieve this, which would have passed even with `compile` broken.
 */
function compileForTarget(
  doc: Document,
  targetOrId: string | Target,
  sink: DiagnosticSink,
): CompileResult {
  const targetId = typeof targetOrId === "string" ? targetOrId : targetOrId.id;
  const requested = typeof targetOrId === "string" ? findTarget(targetOrId) : targetOrId;
  const target = requested ?? FALLBACK_TARGET;

  if (requested === undefined) {
    sink.add({
      code: "unknown_target",
      severity: "warning",
      message: `This page is set to "${targetId}", which this version does not know about. It has been prepared for ${FALLBACK_TARGET.name} instead, which works on most sites.`,
    });
  }

  const parts: string[] = [];
  for (const block of doc.blocks) {
    const emitted = emitBlock(block, target, sink);
    // An empty section contributes nothing. Pushing it would produce a stray
    // blank line, since parts are joined by a blank line.
    if (emitted !== "") {
      parts.push(emitted);
      continue;
    }

    // Contributing nothing is not the same as being silent about it. A section
    // the artist added and has not filled in simply disappeared from the
    // preview, which reads as the tool having lost it rather than as the page
    // being unfinished. Information rather than a warning: nothing was
    // compromised, there is just nothing there yet.
    sink.add({
      code: "section_empty",
      severity: "info",
      blockId: block.id,
      message:
        "This section has nothing in it yet, so it does not appear on your page. Fill it in and it will show up.",
    });
  }

  // Research D4. Blocks are joined by exactly one blank line, which is also
  // what Markdown needs to end most constructs, and the document ends with
  // exactly one newline. An empty page produces an empty string rather than a
  // lone newline, so every whitespace decision is made once rather than
  // emerging from concatenation.
  const markdown = parts.length === 0 ? "" : `${parts.join("\n\n")}\n`;

  const limit = target.capabilities.maxBytes;
  if (limit !== undefined) {
    const bytes = utf8Length(markdown);
    if (bytes > limit) {
      sink.add({
        code: "size_limit_exceeded",
        severity: "warning",
        capability: "maxBytes",
        message: `This page is ${bytes} characters long and ${target.name} accepts about ${limit}. It may be rejected when you paste it. Nothing has been removed.`,
      });
    }
  }

  return { markdown, diagnostics: sink.all, targetId: target.id };
}

/**
 * Byte length in UTF-8.
 *
 * Counted rather than measured with TextEncoder, which is a platform API and
 * would tie a pure module to an environment that provides it. Emoji and
 * non-Latin text are exactly where an artist's page gets close to a limit, so
 * counting UTF-16 code units instead would understate the size of the pages
 * most likely to hit it.
 */
function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
