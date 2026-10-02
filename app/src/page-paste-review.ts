import {
  buildMappedPagePasteBlock, buildProposedBlock, pagePasteConversionIssue, readLines,
  readPagePasteTable, readProposal, readRuns, runText, swapProposalKind,
  type PagePasteTableMapping, type ProposedBlock, type ProposedSection,
} from "./page-text.js";
import { canBeProduct, readCandidates } from "./price-list-text.js";

export interface PagePasteReviewDraft {
  readonly text: string;
  readonly dropped: readonly number[];
  readonly swapped: readonly number[];
  readonly mappings?: Readonly<Record<number, PagePasteTableMapping>>;
  readonly corrections?: Readonly<Record<string, PagePasteRowCorrection>>;
  readonly manualSections?: readonly number[];
  readonly categories?: readonly PagePasteCategory[];
  readonly selectedRowKeys?: readonly string[];
}

export interface PagePasteCategory {
  readonly id: string;
  readonly name: string;
  readonly heading?: string;
}

export interface PagePasteRowCorrection {
  readonly name?: string;
  readonly amount?: string;
  readonly price?: string;
  readonly details?: string;
  readonly included?: boolean;
  readonly acceptedNumericName?: boolean;
  readonly destinationId?: string;
}

export interface PagePasteReviewRow {
  readonly key: string;
  readonly sectionIndex: number;
  readonly sourceLine: number;
  readonly name: string;
  readonly amount: string;
  readonly price: string;
  readonly details: string;
  readonly included?: boolean;
  readonly acceptedNumericName?: boolean;
  readonly destinationId: string;
  readonly selected?: boolean;
  readonly issue?: string;
  readonly warning?: string;
}

export interface PagePasteReviewSection {
  readonly index: number;
  readonly source: ProposedSection;
  readonly proposed: ProposedSection;
  readonly block: ProposedBlock;
  readonly blocks: readonly ProposedBlock[];
  readonly included: boolean;
  readonly rows: readonly PagePasteReviewRow[];
  readonly consumedSourceLines: readonly number[];
  readonly issue?: string;
  readonly blocked?: boolean;
}

export interface PagePasteSourceCoverage {
  readonly sectionIndex: number;
  readonly sourceLine: number;
  readonly kind: "item" | "furniture" | "heading" | "text" | "excluded";
}

export interface PagePasteReview {
  readonly title?: string;
  readonly categories: readonly PagePasteCategory[];
  readonly sections: readonly PagePasteReviewSection[];
  readonly blocks: readonly ProposedBlock[];
  readonly rows: readonly PagePasteReviewRow[];
  readonly coverage: readonly PagePasteSourceCoverage[];
  readonly canConfirm: boolean;
}

function correctedRow(row: PagePasteReviewRow, correction: PagePasteRowCorrection | undefined,
  categories: readonly PagePasteCategory[], defaultIncluded = true, selected = false): PagePasteReviewRow {
  const chosen = { ...row, included: defaultIncluded, ...(selected ? { selected } : {}), ...correction };
  const issue = chosen.included === false ? undefined
    : !categories.some((category) => category.id === chosen.destinationId) ? "Choose a destination category for this row."
      : chosen.name.trim() === "" ? "This price row needs an item name. Name it or exclude this row."
      : /^\d+(?:[.,]\d+)?$/.test(chosen.name.trim()) && chosen.acceptedNumericName !== true
        ? "This numeric item name may be an amount. Accept it if it is the real name." : undefined;
  const warning = chosen.included !== false && chosen.name.trim() !== "" && chosen.price.trim() === ""
    ? "No price is set. This item can stay without a price." : undefined;
  return { ...chosen, ...(issue === undefined ? {} : { issue }), ...(warning === undefined ? {} : { warning }) };
}

function groupedTiers(rows: readonly PagePasteReviewRow[], quantitySourceLines: ReadonlySet<number>): Extract<ProposedBlock, { kind: "menu" }>["tiers"] {
  const tiers: Extract<ProposedBlock, { kind: "menu" }>["tiers"][number][] = [];
  for (let index = 0; index < rows.length;) {
    const first = rows[index];
    if (first === undefined) break;
    let end = index + 1;
    if (first.amount !== "" && first.price !== "") {
      while (end < rows.length && rows[end]?.name === first.name && rows[end]?.details === first.details &&
        rows[end]?.amount !== "" && rows[end]?.price !== "") end += 1;
    }
    tiers.push(end - index < 2 && !quantitySourceLines.has(first.sourceLine) ? reviewedTier(first) : {
      name: first.name, price: "", ...(first.details === "" ? {} : { blurb: first.details }),
      quantities: rows.slice(index, end).map((row) => ({ amount: row.amount, price: row.price })),
    });
    index = end;
  }
  return tiers;
}

function orderedRowBlocks(section: ProposedSection, rows: readonly PagePasteReviewRow[],
  categories: readonly PagePasteCategory[], quantitySourceLines: ReadonlySet<number>,
  manual: boolean, sectionIndex: number): readonly ProposedBlock[] {
  const lines = readLines(section.source);
  const byLine = new Map(rows.map((row) => [row.sourceLine, row]));
  const blocks: ProposedBlock[] = [];
  let textLines: string[] = [];
  let menuRows: PagePasteReviewRow[] = [];
  let destinationId = "";
  const flushText = (): void => {
    if (textLines.some((line) => line.trim() !== "")) blocks.push({ kind: "prose", text: textLines.join("\n") });
    textLines = [];
  };
  const flushMenu = (): void => {
    if (menuRows.length > 0) {
      const category = categories.find((candidate) => candidate.id === destinationId);
      const heading = category?.id.startsWith("new:") ? category.name : category?.heading;
      blocks.push({ kind: "menu", ...(heading === undefined ? {} : { heading }), tiers: groupedTiers(menuRows, quantitySourceLines) });
    }
    menuRows = [];
  };
  const originalHeading = categories.find((category) => category.id === `section:${String(sectionIndex)}`)?.heading;
  const firstIncluded = rows.find((row) => row.included === true);
  const firstRowLine = firstIncluded?.sourceLine ?? Infinity;
  const firstRetainedLine = lines.findIndex((line, offset) => line.kind === "text" && !byLine.has(section.from + offset + 1) && line.text.trim() !== "");
  // CHUNK 3: An all-moved headed section keeps its source heading. Phase 4 must offer an explicit empty-heading recovery choice.
  if (!manual && originalHeading !== undefined &&
    (firstIncluded !== undefined && (firstIncluded.destinationId !== `section:${String(sectionIndex)}` ||
      firstRetainedLine >= 0 && section.from + firstRetainedLine + 1 < firstRowLine) ||
      firstIncluded === undefined && firstRetainedLine >= 0)) {
    const headingLine = lines.find((line) => line.kind === "heading");
    if (headingLine !== undefined) blocks.push(buildProposedBlock({ ...section, kind: "heading", source: headingLine.text }));
  }
  lines.forEach((line, offset) => {
    const sourceLine = section.from + offset + 1;
    const row = byLine.get(sourceLine);
    if (row !== undefined) {
      if (row.included === true) {
        flushText();
        if (menuRows.length > 0 && destinationId !== row.destinationId) flushMenu();
        destinationId = row.destinationId;
        menuRows.push(row);
      } else {
        flushMenu();
        if (manual) textLines.push(line.text);
      }
    } else if (!manual && (line.kind === "heading" || line.kind === "tableHeader" || line.kind === "tableRule" ||
      line.kind === "headingUnderline" || line.kind === "rule")) {
      return;
    } else if (line.text.trim() !== "") {
      flushMenu();
      textLines.push(line.text);
    } else if (textLines.length > 0) textLines.push(line.text);
  });
  flushMenu();
  flushText();
  return blocks;
}

function reviewedTier(row: PagePasteReviewRow): Extract<ProposedBlock, { kind: "menu" }>["tiers"][number] {
  return {
    name: row.name,
    price: row.price,
    ...(row.amount === "" ? {} : { unit: row.amount }),
    ...(row.details === "" ? {} : { blurb: row.details }),
  };
}

function menuSource(section: ProposedSection, block: ProposedBlock): { blocks: readonly ProposedBlock[]; consumedSourceLines: readonly number[]; issue?: string } {
  if (block.kind !== "menu") return { blocks: [block], consumedSourceLines: [] };
  const runs = readRuns(section.source).filter((run) => run.kind === "text");
  const lines = runs.flatMap((run) => run.lines.map((line, offset) => ({ line, sourceLine: section.from + run.from + offset + 1 })));
  if (block.tiers.some((tier) => tier.quantities !== undefined)) {
    const amounts = block.tiers.flatMap((tier) => tier.quantities ?? []);
    const consumedSourceLines = lines.flatMap(({ line, sourceLine }) => line.kind === "text" && amounts.some(({ amount, price }) => line.text.includes(amount) && line.text.includes(price)) ? [sourceLine] : []);
    return consumedSourceLines.length === lines.filter(({ line }) => line.kind === "text" && line.text.trim() !== "").length
      ? { blocks: [block], consumedSourceLines }
      : { blocks: [{ kind: "prose", text: section.source }], consumedSourceLines: [], issue: "Unmatched source lines remain Text so nothing is lost." };
  }
  if (runs.length !== 1) return { blocks: [{ kind: "prose", text: section.source }], consumedSourceLines: [], issue: "Unmatched source lines remain Text so nothing is lost." };
  const run = runs[0];
  if (run === undefined) return { blocks: [block], consumedSourceLines: [] };
  const candidates = readCandidates(runText(run));
  const chosen = candidates.map((candidate) => (candidate.suggested || (candidate.price === "" && candidate.name.trim() !== "")) && canBeProduct(candidate));
  const consumedSourceLines = chosen.flatMap((selected, offset) => selected ? [section.from + run.from + offset + 1] : []);
  if (consumedSourceLines.length !== block.tiers.length) {
    return { blocks: [{ kind: "prose", text: section.source }], consumedSourceLines: [], issue: "Unmatched source lines remain Text so nothing is lost." };
  }
  const unclaimed = run.lines.some((line, index) => line.kind === "text" && line.text.trim() !== "" && !chosen[index]);
  if (!unclaimed) return { blocks: [block], consumedSourceLines };
  if (run.lines.some((line) => line.kind === "tableHeader" || line.kind === "tableRule")) {
    return { blocks: [{ kind: "prose", text: section.source }], consumedSourceLines: [], issue: "Unmatched source lines remain Text so nothing is lost." };
  }
  const blocks: ProposedBlock[] = [];
  let menuTiers: typeof block.tiers = [];
  let textLines: string[] = [];
  let tierIndex = 0;
  const flushMenu = (): void => { if (menuTiers.length > 0) blocks.push({ ...block, tiers: menuTiers }); menuTiers = []; };
  const flushText = (): void => { if (textLines.length > 0) blocks.push({ kind: "prose", text: textLines.join("\n") }); textLines = []; };
  run.lines.forEach((line, index) => {
    if (chosen[index]) {
      flushText();
      const tier = block.tiers[tierIndex];
      if (tier !== undefined) menuTiers = [...menuTiers, tier];
      tierIndex += 1;
    } else if (line.text.trim() !== "") {
      flushMenu();
      textLines.push(line.text);
    }
  });
  flushMenu();
  flushText();
  if (blocks[0]?.kind === "prose") {
    const heading = readRuns(section.source).find((part) => part.kind === "heading");
    if (heading !== undefined) blocks.unshift(buildProposedBlock({ ...section, kind: "heading", source: runText(heading), swappable: false }));
  }
  return { blocks, consumedSourceLines, issue: "A source line that could not become an item stays Text between the Prices sections." };
}

/** One calculation supplies the visible review and the document saved by Add. */
export function buildPagePasteReview(draft: PagePasteReviewDraft): PagePasteReview {
  const proposal = readProposal(draft.text);
  const prepared = proposal.sections.map((source, index) => {
    const proposed = draft.swapped.includes(index) ? swapProposalKind(source) : source;
    const mapping = draft.mappings?.[index];
    const block = mapping === undefined ? buildProposedBlock(proposed) : buildMappedPagePasteBlock(proposed, mapping);
    return { source, index, proposed, mapping, block };
  });
  const categories: PagePasteCategory[] = [
    ...prepared.flatMap(({ index, proposed, mapping, block }) => {
      if (block.kind !== "menu" && mapping === undefined && !draft.manualSections?.includes(index)) return [];
      const sourceHeading = readRuns(proposed.source).find((run) => run.kind === "heading");
      const headingBlock = sourceHeading === undefined ? undefined
        : buildProposedBlock({ ...proposed, kind: "heading", source: runText(sourceHeading) });
      const heading = block.kind === "menu" ? block.heading
        : headingBlock?.kind === "heading" ? headingBlock.text : undefined;
      return [{ id: `section:${String(index)}`, name: heading ?? `Prices section ${String(index + 1)}`,
        ...(heading === undefined ? {} : { heading }) }];
    }),
    ...(draft.categories ?? []),
  ];
  const sections = prepared.map(({ source, index, proposed, mapping, block }): PagePasteReviewSection => {
    const table = mapping === undefined ? undefined : readPagePasteTable(proposed);
    const roles = mapping === undefined ? [] : [mapping.product, mapping.price, ...(mapping.size === undefined ? [] : [mapping.size])];
    const validRoles = table !== undefined && roles.every((role) => Number.isInteger(role) && role >= 0 && role < table.headers.length)
      && new Set(roles).size === roles.length;
    const mappedRows = !validRoles || table === undefined || mapping === undefined ? [] : table.rows.map((row): PagePasteReviewRow => ({
      key: `${String(index)}:${String(row.line)}:0`,
      sectionIndex: index,
      sourceLine: row.line,
      destinationId: `section:${String(index)}`,
      name: row.cells[mapping.product] ?? "",
      amount: mapping.size === undefined ? "" : row.cells[mapping.size] ?? "",
      price: row.cells[mapping.price] ?? "",
      details: row.cells.flatMap((value, column) => value !== "" && !roles.includes(column)
        ? [`${table.headers[column] ?? `Column ${String(column + 1)}`}: ${value}`] : []).join("; "),
    }));
    const menu = mapping === undefined ? menuSource(proposed, block) : undefined;
    const automaticOffers = block.kind !== "menu" ? [] : block.tiers.flatMap((tier) => tier.quantities === undefined
      ? [{ name: tier.name, amount: tier.unit ?? "", price: tier.price, details: tier.blurb ?? "" }]
      : tier.quantities.map((quantity) => ({ name: tier.name, amount: quantity.amount, price: quantity.price, details: tier.blurb ?? "" })));
    const automaticRows = menu?.consumedSourceLines.flatMap((sourceLine, offset): PagePasteReviewRow[] => {
      const offer = automaticOffers[offset];
      return offer === undefined ? [] : [{ key: `${String(index)}:${String(sourceLine)}:0`, sectionIndex: index,
        sourceLine, destinationId: `section:${String(index)}`, ...offer }];
    }) ?? [];
    const quantitySourceLines = new Set<number>();
    if (block.kind === "menu") {
      let offset = 0;
      for (const tier of block.tiers) {
        const count = tier.quantities?.length ?? 1;
        if (tier.quantities !== undefined) for (const row of automaticRows.slice(offset, offset + count))
          quantitySourceLines.add(row.sourceLine);
        offset += count;
      }
    }
    const manual = draft.manualSections?.includes(index) === true && mapping === undefined && block.kind === "prose";
    // CHUNK 2: Header-only pipe tables have no text rows to convert. Phase 4 adds an item-entry recovery action.
    const manualRows: PagePasteReviewRow[] = manual ? readLines(source.source).flatMap((line, offset) => {
      if (line.kind !== "text" || line.text.trim() === "") return [];
      const sourceLine = source.from + offset + 1;
      return [{ key: `${String(index)}:${String(sourceLine)}:0`, sectionIndex: index, sourceLine,
        destinationId: `section:${String(index)}`, name: line.text.trim(), amount: "", price: "", details: "" }];
    }) : [];
    const rows = (manual ? manualRows : mapping === undefined ? automaticRows : mappedRows)
      .map((row) => correctedRow(row, draft.corrections?.[row.key], categories,
        !manual, draft.selectedRowKeys?.includes(row.key) === true));
    const changed = rows.some((row) => draft.corrections?.[row.key] !== undefined);
    const unsafeUncorrected = mapping !== undefined && block.kind === "prose" && rows.some((row) =>
      row.included !== false && draft.corrections?.[row.key] === undefined &&
      (row.name.trim() === "" || row.amount.trim() !== "" && row.price.trim() === ""));
    // CHUNK 3: Keep moved offers at their source positions while a retained Text line splits the Prices blocks.
    const blocks = rows.length > 0 && (manual || block.kind === "menu" || mapping !== undefined && validRoles && changed && !unsafeUncorrected)
      ? orderedRowBlocks(proposed, rows, categories, quantitySourceLines, manual, index)
      : menu?.blocks ?? [block];
    const consumedSourceLines = manual ? rows.filter((row) => row.included === true).map((row) => row.sourceLine)
      : mapping !== undefined ? blocks.some((output) => output.kind === "menu")
        ? rows.filter((row) => row.included !== false).map((row) => row.sourceLine) : []
        : menu?.consumedSourceLines ?? (block.kind === "menu" ? rows.map((row) => row.sourceLine) : []);
    const issue = manual && blocks.some((output) => output.kind === "menu")
      ? blocks.some((output) => output.kind === "prose") ? "Unselected source lines remain Text." : undefined
      : mapping === undefined ? menu?.issue ?? pagePasteConversionIssue(proposed)
      : unsafeUncorrected ? "Correct or exclude the remaining rows with a missing name or price before this table becomes Prices. Source remains Text."
      : blocks.length > 0 && blocks.every((output) => output.kind === "prose")
        ? "These columns could not make Prices. The source remains Text." : undefined;
    return { index, source, proposed, block, blocks, included: !draft.dropped.includes(index), rows, consumedSourceLines,
      ...(changed && unsafeUncorrected ? { blocked: true } : {}), ...(issue === undefined ? {} : { issue }) };
  });

  const coverage = sections.flatMap((section): PagePasteSourceCoverage[] => {
    const itemLines = new Set(section.consumedSourceLines);
    const manual = draft.manualSections?.includes(section.index) === true;
    return readLines(section.source.source).flatMap((line, offset) => {
      if (line.text.trim() === "") return [];
      const sourceLine = section.source.from + offset + 1;
      const kind = !section.included || section.blocks.length === 0 || (!manual && section.rows.some((row) => row.sourceLine === sourceLine && row.included === false)) ? "excluded"
        : manual ? itemLines.has(sourceLine) ? "item" : "text"
          : section.blocks.every((block) => block.kind === "prose") ? "text"
          : line.kind === "heading" ? "heading"
            : line.kind === "tableHeader" || line.kind === "tableRule" || line.kind === "headingUnderline" || line.kind === "rule" ? "furniture"
              : itemLines.has(sourceLine) ? "item" : "text";
      return [{ sectionIndex: section.index, sourceLine, kind }];
    });
  });
  const blocks = sections.flatMap((section) => section.included ? section.blocks : []);
  const rows = sections.flatMap((section) => section.rows);
  return { ...(proposal.title === undefined ? {} : { title: proposal.title }), categories, sections, blocks, rows, coverage,
    canConfirm: !sections.some((section) => section.included && (section.blocked === true ||
      section.rows.some((row) => row.included !== false && row.issue !== undefined))) };
}
