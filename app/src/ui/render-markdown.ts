/**
 * Renders the compiled Markdown for the preview.
 *
 * Constitution Principle VII: the preview renders the COMPILED OUTPUT, never an
 * internal render of the block model. Showing the artist a picture no host will
 * produce would make the whole product a lie.
 *
 * This renderer only handles the narrow subset the compiler emits. That is not
 * a limitation, it is the design: we know exactly what our own compiler
 * produces, so a general Markdown parser would be a dependency doing far more
 * than the job needs, with far more surface to be wrong about.
 *
 * ON THE SANITIZER, and why there is not one.
 *
 * The original plan called for sanitizing the preview HTML. There is nothing to
 * sanitize, because no HTML is ever parsed. Every node here is built with
 * `createElement` and every piece of text is set with `textContent`. There is
 * no `innerHTML` anywhere in this application, so there is no path from artist
 * text to markup at all.
 *
 * That is strictly stronger than sanitizing. A sanitizer is a filter that has
 * to be right about every input; this is a design in which the dangerous
 * operation is simply never performed.
 *
 * ON THE ADDRESSES, which is a separate question.
 *
 * Not parsing HTML says nothing about what goes into an `href` or a `src`, and
 * those are the only values here a browser will act on. This used to lean
 * entirely on the compiler having refused anything but http and https, which is
 * true, and on the escaper putting a backslash between `]` and `(` so a refused
 * link cannot match the pattern below, which is also true and is a load-bearing
 * fact living in a different module. Nothing asserted either of them: this file
 * had no test at all, and the comment here claimed a corpus test that did not
 * exist. Verified by breaking the coupling on purpose, at which point seven
 * payloads produced live `javascript:` addresses.
 *
 * So the scheme is now checked here as well, where it is used. Two independent
 * reasons the bad case cannot happen is the right number for the only value on
 * this page a browser will execute.
 */

/** Only an address a browser may safely be handed. Anything else is text. */
function safeAddress(url: string): string | undefined {
  // Browsers strip whitespace and control characters before reading a scheme,
  // so this has to see what they will see rather than what was written. The
  // same cleaning the engine's own address check does, for the same reason.
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/[\s\u0000-\u001f\u007f]/g, "");
  return /^https?:\/\//i.test(cleaned) ? url : undefined;
}

/** Entities the escaper produces, turned back into the characters they stand for. */
function decodeEntities(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** Backslash escapes the escaper added, removed for display. */
function unescape(text: string): string {
  return decodeEntities(text).replace(/\\([\\`*_{}[\]()#+\-.!|~^$])/g, "$1");
}

/**
 * Renders one line of inline content into a fragment.
 *
 * Order matters: images before links, because an image inside a link shares the
 * same bracket syntax and the longer pattern has to win.
 */
function inline(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const pattern = /(!?)\[([^\]]*)\]\(([^)]*)\)|(\*\*)([^*]+)\*\*|(\*)([^*]+)\*/g;

  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > last) frag.append(unescape(text.slice(last, at)));

    const address = safeAddress(match[3] ?? "");

    if (match[1] === "!") {
      if (address === undefined) {
        // Not an address, so it stays what it always was: the artist's words.
        frag.append(unescape(match[0]));
      } else {
        const img = document.createElement("img");
        img.src = address;
        img.alt = unescape(match[2] ?? "");
        img.loading = "lazy";
        frag.append(img);
      }
    } else if (match[2] !== undefined) {
      if (address === undefined) {
        frag.append(unescape(match[0]));
      } else {
        const a = document.createElement("a");
        a.href = address;
        a.rel = "noopener noreferrer nofollow";
        a.target = "_blank";
        a.append(unescape(match[2]));
        frag.append(a);
      }
    } else if (match[4] !== undefined) {
      const strong = document.createElement("strong");
      strong.append(unescape(match[5] ?? ""));
      frag.append(strong);
    } else if (match[6] !== undefined) {
      const em = document.createElement("em");
      em.append(unescape(match[7] ?? ""));
      frag.append(em);
    }

    last = at + match[0].length;
  }

  if (last < text.length) frag.append(unescape(text.slice(last)));
  return frag;
}

/** Splits a table row into its cells, respecting escaped pipes. */
function cells(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line) && line.includes("-");
}

/**
 * Renders compiled Markdown into DOM nodes.
 *
 * Line based, because everything the compiler emits is line based. Blank lines
 * separate blocks, which is the rule the compiler itself follows.
 */
export function renderMarkdown(markdown: string): DocumentFragment {
  const out = document.createDocumentFragment();
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})(?:\s+(.*))?$/.exec(line);
    if (heading !== null) {
      const level = (heading[1] ?? "#").length;
      const node = document.createElement(`h${level}` as "h1");
      node.append(inline(heading[2] ?? ""));
      out.append(node);
      i += 1;
      continue;
    }

    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      out.append(document.createElement("hr"));
      i += 1;
      continue;
    }

    if (isTableRow(line)) {
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const body = document.createElement("tbody");
      let row = 0;

      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        const current = lines[i] ?? "";
        if (isSeparatorRow(current)) {
          i += 1;
          continue;
        }
        const tr = document.createElement("tr");
        for (const text of cells(current)) {
          const cell = document.createElement(row === 0 ? "th" : "td");
          cell.append(inline(text));
          tr.append(cell);
        }
        (row === 0 ? head : body).append(tr);
        row += 1;
        i += 1;
      }

      if (head.hasChildNodes()) table.append(head);
      if (body.hasChildNodes()) table.append(body);
      out.append(table);
      continue;
    }

    if (line.startsWith("- ")) {
      const ul = document.createElement("ul");
      while (i < lines.length && (lines[i] ?? "").startsWith("- ")) {
        const li = document.createElement("li");
        li.append(inline((lines[i] ?? "").slice(2)));
        ul.append(li);
        i += 1;
      }
      out.append(ul);
      continue;
    }

    // A paragraph runs until a blank line. A trailing backslash is the hard
    // line break the prose emitter produces.
    const paragraph = document.createElement("p");
    let first = true;
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !isTableRow(lines[i] ?? "")) {
      const current = lines[i] ?? "";
      if (!first) paragraph.append(document.createElement("br"));
      paragraph.append(inline(current.replace(/\\$/, "")));
      first = false;
      i += 1;
    }
    out.append(paragraph);
  }

  return out;
}
