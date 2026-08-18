/**
 * What a host can do, and what to do when it cannot.
 *
 * Constitution Principle II: a host is data. Nothing in `emit/` may branch on
 * which host it is compiling for. It asks what the deepest heading level is, or
 * what this host renders as a separator, and the answer comes from here.
 *
 * A capability only exists once an emitter consults it and a fallback test
 * proves what happens when a host lacks it. A capability with no consumer is a
 * guess written down.
 */

export interface Capabilities {
  /** Deepest heading level this host renders. 1 to 6. */
  readonly maxHeadingLevel: number;
  /**
   * Exactly what this host renders as a section separator.
   *
   * Architecture review R-1: `***`, not `---`. A line of `---` immediately
   * after text makes that text a heading, and a document opening with `---` is
   * read as front matter by several renderers. `***` can do neither.
   */
  readonly thematicBreak: string;
  /**
   * Whether this host renders GFM pipe tables.
   *
   * A menu of tiers and prices reads far better as a table. Where a host lacks
   * them the menu degrades to a definition style list, which is readable but
   * loses the column alignment that makes prices scannable.
   */
  readonly tables: boolean;
  /**
   * How this host writes a line break inside a paragraph.
   *
   * `backslash` is the CommonMark form. `spaces` is two trailing spaces, which
   * predates it and is what Python-Markdown implements.
   *
   * This capability exists because of a real failure. The compiler emitted the
   * backslash form everywhere, and on rentry it produced no line break AND
   * swallowed the character, so "each." and "Refunds" rendered as
   * "each.Refunds". Found by pasting real output into rentry's preview, not by
   * any test, because every test encoded the same assumption as the emitter.
   */
  readonly hardBreak: "backslash" | "spaces";
  /** Which escaping rules apply to artist text. Never optional. */
  readonly escapeStyle: "commonmark";
  /**
   * Stated size limit for one page, in bytes.
   *
   * Absent means the host documents no limit. Absent is NOT the same as
   * unlimited: it means we do not know, and the project's rule is that an
   * undocumented behaviour is recorded as unknown rather than assumed.
   */
  readonly maxBytes?: number;
}

export interface Target {
  readonly id: string;
  readonly name: string;
  readonly capabilities: Capabilities;
  /**
   * Where each capability value came from. FR-014: a capability value may not
   * be written from assumption, and this is where that is enforced socially,
   * since a reviewer can see an empty citation.
   */
  readonly sources: Readonly<Record<keyof Capabilities, string>>;
}
