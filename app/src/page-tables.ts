/** Physical table spans. Source text is never rewritten by this reader. */
export interface PagePasteTable {
  readonly headers: readonly string[];
  readonly rows: readonly { readonly line: number; readonly cells: readonly string[] }[];
  readonly furnitureLines: readonly number[];
}

export interface PageTableSpan {
  readonly from: number;
  readonly to: number;
  readonly delimiter: "," | "\t" | "|";
  readonly table?: PagePasteTable;
}

export function pipeCells(text: string): readonly string[] {
  const cells: string[] = [];
  let cell = "";
  const bare = text.trim();
  for (let i = 0; i < bare.length; i += 1) {
    const char = bare[i] ?? "";
    if (char === "\\" && (bare[i + 1] === "|" || bare[i + 1] === "\\")) {
      cell += bare[i + 1];
      i += 1;
    } else if (char === "|") { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim());
  if (bare.startsWith("|")) cells.shift();
  if (cells.at(-1) === "" && bare.endsWith("|")) cells.pop();
  return cells;
}

function csvCells(text: string, continued = false): { cells: readonly string[]; open: boolean; valid: boolean } {
  const cells: string[] = [];
  let cell = "";
  let open = continued;
  let closed = false;
  let valid = !continued;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";
    if (open) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') { open = false; closed = true; }
      else cell += char;
    } else if (char === ",") { cells.push(closed ? cell : cell.trim()); cell = ""; closed = false; }
    else if (char === '"') { if (cell !== "" || closed) valid = false; open = true; }
    else { if (char === '"' || closed) valid = false; cell += char; }
  }
  cells.push(closed ? cell : cell.trim());
  return { cells, open, valid: valid && !open };
}

function namedHeader(cells: readonly string[]): boolean {
  return cells.length >= 2 && cells.every((cell) => cell !== "") &&
    cells.some((cell) => /^(?:item|product|name|service)$/i.test(cell)) &&
    cells.some((cell) => /^(?:price|selling price|rate)$/i.test(cell));
}

function pipeRule(line: string): boolean {
  return line.includes("|") && pipeCells(line).every((cell) => /^:?-+:?$/.test(cell));
}

/** Linear scan, including quoted continuations across blank and heading lines. */
export function scanPageTables(lines: readonly string[], sourceOffset = 0): readonly PageTableSpan[] {
  const spans: PageTableSpan[] = [];
  for (let from = 0; from < lines.length; from += 1) {
    const first = lines[from] ?? "";
    if (first.trim() === "") continue;
    const csv = first.includes(",") ? csvCells(first) : undefined;
    const delimiter = first.includes("|") && pipeRule(lines[from + 1] ?? "") ? "|"
      : first.includes("\t") ? "\t" : csv?.valid === true && namedHeader(csv.cells) ? "," : undefined;
    if (delimiter === undefined) continue;
    const headers = delimiter === "|" ? pipeCells(first) : delimiter === "\t" ? first.split("\t").map((cell) => cell.trim()) : csv?.cells ?? [];
    const headed = delimiter === "|" || namedHeader(headers);
    const rows: { line: number; cells: readonly string[] }[] = [];
    const furnitureLines = headed ? [sourceOffset + from + 1] : [];
    let valid = headers.length >= 2;
    let open = false;
    let to = from;
    for (let index = from; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const record: ReturnType<typeof csvCells> | undefined = delimiter === "," ? csvCells(line, open) : undefined;
      if (!open && record?.open !== true && (!line.includes(delimiter) || line.trim() === "")) break;
      const cells = delimiter === "|" ? pipeCells(line) : delimiter === "\t" ? line.split("\t").map((cell) => cell.trim()) : record?.cells ?? [];
      const repeatedHeader = headed && cells.length === headers.length && cells.every((cell, column) => cell.toLowerCase() === headers[column]?.toLowerCase());
      if (!open && record?.valid !== false && index > from && delimiter !== "|" && namedHeader(cells) && !repeatedHeader) break;
      to = index;
      open = record?.open ?? false;
      if (record !== undefined && !record.valid) valid = false;
      if (cells.length !== headers.length) valid = false;
      if (index === from && headed) continue;
      if (delimiter === "|" && pipeRule(line)) {
        if (index !== from + 1 && furnitureLines.at(-1) !== sourceOffset + index) valid = false;
        furnitureLines.push(sourceOffset + index + 1);
      } else if (repeatedHeader) {
        furnitureLines.push(sourceOffset + index + 1);
      } else {
        if (cells.every((cell) => cell === "")) valid = false;
        rows.push({ line: sourceOffset + index + 1, cells });
      }
    }
    if (delimiter === "\t" && !headed && to === from) continue;
    valid = valid && !open && rows.length >= (headed ? 1 : 2);
    spans.push({ from, to, delimiter, ...(valid ? { table: {
      headers: headed ? headers : headers.map((_, column) => `Column ${String(column + 1)}`), rows, furnitureLines,
    } } : {}) });
    from = to;
  }
  return spans;
}
