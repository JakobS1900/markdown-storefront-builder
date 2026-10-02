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
  readonly sourceUses?: Readonly<Record<number, PagePasteSourceUse>>;
  readonly emptyHeadingChoices?: Readonly<Record<number, "keep" | "remove">>;
  readonly addedItems?: Readonly<Record<number, { readonly name: string; readonly amount: string; readonly price: string;
    readonly allowBlankPrice?: boolean }>>;
}

export interface PagePasteSourceUse {
  readonly role: "name" | "category";
  readonly rowKeys: readonly string[];
  readonly previous?: Readonly<Record<string, PagePasteRowCorrection>>;
}

export interface PagePasteSourceCandidate {
  readonly sourceLine: number;
  readonly sectionIndex: number;
  readonly value: string;
}

export interface PagePasteSourceCandidates {
  readonly name?: PagePasteSourceCandidate;
  readonly category?: PagePasteSourceCandidate;
}

/** Exact preceding source, independent of any words typed into a correction. */
function sourceCandidates(sections: readonly ProposedSection[], tableIndex: number): PagePasteSourceCandidates {
  const table = sections[tableIndex];
  if (table === undefined) return {};
  const block = buildProposedBlock(table);
  if (readPagePasteTable(table) === undefined &&
    !(block.kind === "menu" && block.tiers.some((tier) => tier.quantities !== undefined))) return {};
  const currentLines = readLines(table.source);
  const currentHeading = currentLines.findIndex((line) => line.kind === "heading");
  const previous = sections[tableIndex - 1];
  const previousLines = previous === undefined ? [] : readLines(previous.source)
    .map((line, offset) => ({ line, sourceLine: previous.from + offset + 1 }))
    .filter(({ line }) => line.text.trim() !== "");
  const nearest = previousLines.at(-1);
  const standalone = currentHeading < 0 && previous?.kind === "prose" && nearest?.line.kind === "text" &&
    previousLines.every(({ line }) => line.kind === "text")
    ? { sourceLine: nearest.sourceLine, sectionIndex: tableIndex - 1,
      value: nearest.line.text.trim() } : undefined;
  let category: PagePasteSourceCandidate | undefined;
  for (let index = currentHeading >= 0 ? tableIndex : tableIndex - 1; index >= 0; index -= 1) {
    const section = sections[index];
    if (section === undefined) continue;
    const offset = readLines(section.source).findIndex((line) => line.kind === "heading");
    if (offset < 0) continue;
    const sourceLine = section.from + offset + 1;
    const heading = buildProposedBlock({ ...section, kind: "heading", source: readLines(section.source)[offset]?.text ?? "" });
    if (heading.kind === "heading" && heading.text !== "") category = { sourceLine, sectionIndex: index, value: heading.text };
    break;
  }
  return { ...(standalone === undefined ? {} : { name: standalone }),
    ...(category === undefined ? {} : { category }) };
}

export function findPagePasteSourceCandidates(text: string, tableIndex: number): PagePasteSourceCandidates {
  return sourceCandidates(readProposal(text).sections, tableIndex);
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
  readonly headingRecovery?: boolean;
}

export interface PagePasteSourceCoverage {
  readonly sectionIndex: number;
  readonly sourceLine: number;
  readonly kind: "item" | "furniture" | "heading" | "text" | "excluded" | "usedName" | "usedCategory";
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
  manual: boolean, sectionIndex: number, blockDestinations: WeakMap<ProposedBlock, string>): readonly ProposedBlock[] {
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
      const block: ProposedBlock = { kind: "menu", ...(heading === undefined ? {} : { heading }),
        tiers: groupedTiers(menuRows, quantitySourceLines) };
      blocks.push(block);
      blockDestinations.set(block, destinationId);
    }
    menuRows = [];
  };
  const originalHeading = categories.find((category) => category.id === `section:${String(sectionIndex)}`)?.heading;
  const headingOffset = lines.findIndex((line) => line.kind === "heading");
  const sourceHeadingId = headingOffset < 0 ? undefined : `source:${String(section.from + headingOffset + 1)}`;
  const firstIncluded = rows.find((row) => row.included === true);
  const firstRowLine = firstIncluded?.sourceLine ?? Infinity;
  const firstRetainedLine = lines.findIndex((line, offset) => line.kind === "text" && !byLine.has(section.from + offset + 1) && line.text.trim() !== "");
  if (!manual && originalHeading !== undefined &&
    (firstIncluded !== undefined && (firstIncluded.destinationId !== `section:${String(sectionIndex)}` &&
      firstIncluded.destinationId !== sourceHeadingId ||
      firstRetainedLine >= 0 && section.from + firstRetainedLine + 1 < firstRowLine) ||
      firstIncluded === undefined)) {
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
  const sourceLines = readLines(draft.text);
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
    ...Object.entries(draft.sourceUses ?? {}).flatMap(([sourceLine, use]) => {
      if (use.role !== "category") return [];
      const line = sourceLines[Number(sourceLine) - 1];
      if (line?.kind !== "heading") return [];
      const heading = buildProposedBlock({ kind: "heading", source: line.text,
        from: Number(sourceLine) - 1, to: Number(sourceLine) - 1, swappable: false });
      return heading.kind === "heading" ? [{ id: `source:${sourceLine}`, name: heading.text, heading: heading.text }] : [];
    }),
    ...(draft.categories ?? []),
  ];
  const blockDestinations = new WeakMap<ProposedBlock, string>();
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
    const rowBlocks = rows.length > 0 && (manual || block.kind === "menu" || mapping !== undefined && validRoles && changed && !unsafeUncorrected)
      ? orderedRowBlocks(proposed, rows, categories, quantitySourceLines, manual, index, blockDestinations)
      : menu?.blocks ?? [block];
    const headingRecovery = rows.length > 0 && rowBlocks.some((output) => output.kind === "heading") &&
      rows.every((row) => row.included !== true ||
        row.destinationId !== `section:${String(index)}`);
    const headingChoice = draft.emptyHeadingChoices?.[index];
    const addedItem = draft.addedItems?.[index];
    const addedItemNeedsPrice = addedItem !== undefined && addedItem.name.trim() !== "" &&
      addedItem.amount.trim() !== "" && addedItem.price.trim() === "" && addedItem.allowBlankPrice !== true;
    const blocks = [
      ...rowBlocks.filter((output) => !(headingRecovery && headingChoice === "remove" && output.kind === "heading")),
      ...(addedItem === undefined || addedItem.name.trim() === "" ? [] : [{ kind: "menu" as const,
        tiers: [{ name: addedItem.name, price: addedItem.price,
          ...(addedItem.amount === "" ? {} : { unit: addedItem.amount }) }] }]),
    ];
    const consumedSourceLines = manual ? rows.filter((row) => row.included === true).map((row) => row.sourceLine)
      : mapping !== undefined ? blocks.some((output) => output.kind === "menu")
        ? rows.filter((row) => row.included !== false).map((row) => row.sourceLine) : []
        : menu?.consumedSourceLines ?? (block.kind === "menu" ? rows.map((row) => row.sourceLine) : []);
    const issue = headingRecovery && headingChoice === undefined
      ? "No offers remain in this category. Keep or remove its heading before Add."
      : addedItem !== undefined && addedItem.name.trim() === ""
        ? "Name the new item or remove it before Add."
      : addedItemNeedsPrice ? "This new amount needs a price. Enter one or choose Keep without a price."
      : manual && blocks.some((output) => output.kind === "menu")
      ? blocks.some((output) => output.kind === "prose") ? "Unselected source lines remain Text." : undefined
      : mapping === undefined ? menu?.issue ?? pagePasteConversionIssue(proposed)
      : unsafeUncorrected ? "Correct or exclude the remaining rows with a missing name or price before this table becomes Prices. Source remains Text."
      : blocks.length > 0 && blocks.every((output) => output.kind === "prose")
        ? "These columns could not make Prices. The source remains Text." : undefined;
    return { index, source, proposed, block, blocks, included: !draft.dropped.includes(index), rows, consumedSourceLines,
      ...(changed && unsafeUncorrected || headingRecovery && headingChoice === undefined ||
        addedItem !== undefined && addedItem.name.trim() === "" || addedItemNeedsPrice ? { blocked: true } : {}),
      ...(headingRecovery ? { headingRecovery: true } : {}), ...(issue === undefined ? {} : { issue }) };
  });

  const activeUses = new Map<number, PagePasteSourceUse["role"]>();
  const rowOwners = new Map(sections.flatMap((section) => section.rows.map((row) => [row.key, { section, row }] as const)));
  const candidateCache = new Map<number, PagePasteSourceCandidates>();
  const usedDestinations = new Set(sections.flatMap((section) => section.included
    ? section.rows.filter((row) => row.included === true).map((row) => row.destinationId) : []));
  for (const [key, use] of Object.entries(draft.sourceUses ?? {})) {
    const sourceLine = Number(key);
    const sourceSection = sections.find((section) => sourceLine > section.source.from && sourceLine <= section.source.to + 1);
    if (sourceSection === undefined || !sourceSection.included ||
      sourceSection.rows.some((row) => row.sourceLine === sourceLine && row.included === true) ||
      use.role === "category" && sourceLines[sourceLine - 1]?.kind !== "heading" ||
      use.role === "name" && sourceSection.block.kind !== "prose") continue;
    const active = use.role === "category" ? usedDestinations.has(`source:${key}`) : use.rowKeys.some((rowKey) => {
      const owner = rowOwners.get(rowKey);
      if (owner === undefined || !owner.section.included || owner.row.included !== true) return false;
      let candidates = candidateCache.get(owner.row.sectionIndex);
      if (candidates === undefined) {
        candidates = sourceCandidates(proposal.sections, owner.row.sectionIndex);
        candidateCache.set(owner.row.sectionIndex, candidates);
      }
      const candidate = candidates[use.role];
      return candidate?.sourceLine === sourceLine && owner.row.name === candidate.value;
    });
    if (active) activeUses.set(sourceLine, use.role);
  }
  const reviewedSections = sections.map((section) => {
    const lines = readLines(section.source.source);
    const usedName = lines.find((line, offset) => line.kind === "text" &&
      activeUses.get(section.source.from + offset + 1) === "name");
    const usedHeading = lines.some((line, offset) => line.kind === "heading" &&
      activeUses.get(section.source.from + offset + 1) === "category");
    if (usedName === undefined && !usedHeading) return section;
    let proseIndex = -1;
    if (usedName !== undefined) section.blocks.forEach((block, index) => {
      if (block.kind === "prose" && block.text.split("\n").includes(usedName.text)) proseIndex = index;
    });
    const blocks = section.blocks.flatMap((block, index): ProposedBlock[] => {
      if (usedHeading && block.kind === "heading") return [];
      if (index !== proseIndex || block.kind !== "prose" || usedName === undefined) return [block];
      const retained = block.text.split("\n");
      retained.splice(retained.lastIndexOf(usedName.text), 1);
      return retained.some((line) => line.trim() !== "") ? [{ ...block, text: retained.join("\n") }] : [];
    });
    const next = { ...section, blocks };
    if (next.issue === "Unselected source lines remain Text." && !blocks.some((block) => block.kind === "prose"))
      delete next.issue;
    if (usedHeading && section.headingRecovery === true && blocks.every((block) => block.kind !== "heading") &&
      draft.addedItems?.[section.index] === undefined) {
      delete next.blocked;
      delete next.issue;
    }
    return next;
  });
  const coverage = reviewedSections.flatMap((section): PagePasteSourceCoverage[] => {
    const itemLines = new Set(section.consumedSourceLines);
    const manual = draft.manualSections?.includes(section.index) === true;
    const usedHeading = readLines(section.source.source).some((line, offset) => line.kind === "heading" &&
      activeUses.get(section.source.from + offset + 1) === "category");
    return readLines(section.source.source).flatMap((line, offset) => {
      if (line.text.trim() === "") return [];
      const sourceLine = section.source.from + offset + 1;
      const used = section.included ? activeUses.get(sourceLine) : undefined;
      const kind = used === "name" ? "usedName" : used === "category" ? "usedCategory"
        : !section.included ? "excluded"
        : line.kind === "headingUnderline" && usedHeading ? "furniture"
        : section.blocks.length === 0 ||
        (line.kind === "heading" && section.headingRecovery === true && draft.emptyHeadingChoices?.[section.index] === "remove") ||
        (!manual && section.rows.some((row) => row.sourceLine === sourceLine && row.included === false)) ? "excluded"
        : manual ? itemLines.has(sourceLine) ? "item" : "text"
          : section.block.kind === "prose" && section.blocks.some((output) => output.kind === "prose" && output.text === section.source.source)
            ? "text"
          : section.blocks.every((block) => block.kind === "prose") ? "text"
          : line.kind === "heading" ? "heading"
            : line.kind === "tableHeader" || line.kind === "tableRule" || line.kind === "headingUnderline" || line.kind === "rule" ? "furniture"
              : itemLines.has(sourceLine) ? "item" : "text";
      return [{ sectionIndex: section.index, sourceLine, kind }];
    });
  });
  const blocks: ProposedBlock[] = [];
  let visibleSourceHeading: string | undefined;
  let previousDestination: string | undefined;
  let usedGap = false;
  const destinationKey = (id: string): string => {
    if (!id.startsWith("section:")) return id;
    const section = reviewedSections[Number(id.slice(8))];
    if (section === undefined) return id;
    const headingOffset = readLines(section.source.source).findIndex((line) => line.kind === "heading");
    const sourceLine = section.source.from + headingOffset + 1;
    return headingOffset >= 0 && activeUses.get(sourceLine) === "category" ? `source:${String(sourceLine)}` : id;
  };
  for (const section of reviewedSections) {
    if (!section.included) { usedGap = false; continue; }
    if (section.blocks.length === 0 && readLines(section.source.source).some((_, offset) =>
      activeUses.has(section.source.from + offset + 1))) { usedGap = true; continue; }
    const destinations = [...new Set(section.rows.filter((row) => row.included === true).map((row) => row.destinationId))];
    for (const block of section.blocks) {
      const destinationId = blockDestinations.get(block) ?? (section.blocks.length === 1 && destinations.length === 1
        ? destinations[0] : undefined);
      const destination = block.kind === "menu" && destinationId !== undefined ? destinationKey(destinationId) : undefined;
      const sourceCategory = destination?.startsWith("source:") === true &&
        activeUses.get(Number(destination.slice(7))) === "category";
      const previous = blocks.at(-1);
      if (usedGap && previous?.kind === "menu" && block.kind === "menu" &&
        previousDestination !== undefined && previousDestination === destination && previous.heading === block.heading) {
        blocks[blocks.length - 1] = { ...previous, tiers: [...previous.tiers, ...block.tiers] };
      } else if (block.kind === "menu" && sourceCategory && visibleSourceHeading === destination) {
        const unheaded = { ...block };
        delete unheaded.heading;
        blocks.push(unheaded);
      } else blocks.push(block);
      if (block.kind === "heading" || block.kind === "menu")
        visibleSourceHeading = block.kind === "menu" && sourceCategory ? destination : undefined;
      previousDestination = destination;
      usedGap = false;
    }
  }
  const rows = reviewedSections.flatMap((section) => section.rows);
  return { ...(proposal.title === undefined ? {} : { title: proposal.title }), categories, sections: reviewedSections, blocks, rows, coverage,
    canConfirm: !reviewedSections.some((section) => section.included && (section.blocked === true ||
      section.rows.some((row) => row.included !== false && row.issue !== undefined))) };
}
