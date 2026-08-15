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
