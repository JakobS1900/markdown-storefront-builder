/**
 * Compile diagnostics: every compromise the compiler made, named.
 *
 * This is the product's actual selling point. It is the thing an artist would
 * otherwise pay someone to know, and it is what makes the tool feel like it
 * understands the host rather than merely producing text.
 *
 * The shape deliberately mirrors the validation `Issue` from feature 001, so
 * the app has one way of pointing at a block rather than two.
 */

export type DiagnosticCode =
  | "unknown_target"
  | "heading_level_reduced"
  | "size_limit_exceeded"
  | "table_unsupported"
  | "link_scheme_refused";

export type DiagnosticSeverity = "info" | "warning";

export interface CompileDiagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  /** The section affected. Absent when the diagnostic is about the whole page. */
  readonly blockId?: string;
  /** Which capability caused it, when one did. */
  readonly capability?: string;
  /** Written for the artist. SC-005: they must be able to tell which part it concerns. */
  readonly message: string;
}

export interface CompileResult {
  /** LF line endings, one trailing newline. Empty for a page with no blocks. */
  readonly markdown: string;
  readonly diagnostics: readonly CompileDiagnostic[];
  /**
   * The target actually used, which differs from the requested one when an
   * unknown host fell back.
   *
   * Review R-5: the app must NOT write this back into the page as the artist's
   * chosen target. Doing so would silently rewrite an unknown host to
   * `portable` and destroy their choice just by opening the page in an older
   * build, which is the failure feature 001's review was avoiding.
   */
  readonly targetId: string;
}

/** Collects diagnostics during a compile. Order follows the page. */
export class DiagnosticSink {
  private readonly items: CompileDiagnostic[] = [];

  add(diagnostic: CompileDiagnostic): void {
    this.items.push(diagnostic);
  }

  get all(): readonly CompileDiagnostic[] {
    return this.items;
  }
}
