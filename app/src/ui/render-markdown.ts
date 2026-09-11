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
  // Anchored, and requiring something after the slashes, which is what the
  // engine's `isSafeUrl` has always required. This was `/^https?:\/\//i`, so
  // the bare string `https://` was refused there and accepted here, and the
  // renderer would build `<img src="https://">` from something the compiler
  // would never have emitted.
  //
  // Not a live hole, because this only ever sees compiled output and the
  // compiler refuses that address first. It is recorded and fixed anyway: the
  // stated reason these two checks are duplicated rather than shared is that a
  // scheme hidden from one and not the other is a hole in whichever ends up
  // laxer. A drift nobody can currently reach is still a drift.
  if (/^https?:\/\/[^\s]+$/i.test(cleaned)) return url;

  // A picture held on the seller's own device, named rather than addressed.
  // T047. No browser implements this scheme, so one that somehow reached a
  // reader is an image that fails to load: it cannot navigate and it cannot
  // execute. The menu file exporter replaces every one with real bytes, or
  // removes the element, before the file is written.
  //
  // It is allowed here so the address survives into an ELEMENT. Without that,
  // the renderer degrades it to the seller's literal words and the exporter's
  // only option is to find the token in the compiled Markdown by pattern. That
  // was the first design and it was forgeable: an item named
  // `X](mdsb-asset:evil)` compiles to an alt containing exactly that text, and
  // a pattern cannot tell the seller's words from the compiler's structure
  // because by then they are the same characters. Removing the supposed token
  // destroyed the real picture beside it.
  //
  // A node carries that distinction in the tree, and seller text can never
  // become a node. That is what research D3 meant by resolving on the DOM, and
  // it only works now that the label pattern above is correct.
  return /^mdsb-asset:[^\s]*$/i.test(cleaned) ? url : undefined;
}

/**
 * Entities the escaper produces, turned back into the characters they stand for.
 *
 * The numeric references matter as much as the named ones. When three
 * characters moved from backslash escapes to numeric references, so that rentry
 * would stop publishing "\$45", this function still knew only the three named
 * entities and the preview began showing the artist "&#36;45". The preview
 * renders the compiled output, so anything the compiler did for the host's
 * benefit has to be undone here or the artist is looking at plumbing.
 *
 * Decoding a reference cannot produce markup. Every result goes into a text
 * node, so a decoded `<` is a less-than sign and never the start of a tag,
 * which is the same property the whole file rests on.
 *
 * `&amp;` is decoded last, mirroring the escaper encoding it first. An artist
 * who literally types `&#36;` has it stored as `&amp;#36;`, which contains no
 * numeric reference until the final step, so it survives as the text they
 * typed rather than turning into a dollar sign.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : _;
    })
    .replace(/&amp;/g, "&");
}

/**
 * Backslash escapes the escaper added, removed for display.
 *
 * `=` joined this set with feature 028, and it is not optional. The escaper now
 * backslashes every equals sign in a run of two or more, and a line that is
 * equals signs and nothing else, so that a seller's own writing cannot become a
 * setext heading or a highlight on a paste host. Without the same character
 * here, the preview shows the seller `A \=\=highlight\=\=` and the Copy tab
 * would be the only honest surface in the app.
 */
function unescape(text: string): string {
  return decodeEntities(text).replace(/\\([\\`*_{}[\]()#+\-.!|~^$=])/g, "$1");
}

/**
 * Renders one line of inline content into a fragment.
 *
 * Order matters: images before links, because an image inside a link shares the
 * same bracket syntax and the longer pattern has to win.
 */
function inline(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  // The label accepts an escaped anything, or any character that is neither a
  // closing bracket nor a backslash. `[^\]]*` was the obvious version and it
  // was wrong in both directions at once.
  //
  // The compiler escapes a seller's brackets, so an item named `A]B` arrives as
  // `A\]B`. A pattern that merely excludes `]` stops inside that escape rather
  // than at the end of the label. Before parentheses were escaped that let a
  // seller forge an address: the label ended early, the rest of their own text
  // supplied `](`, and the renderer built an image pointing wherever they said.
  // After parentheses were escaped the forgery stopped and the legitimate image
  // stopped with it, because the real `](` was no longer reachable either.
  //
  // Both halves are needed. The escaping stops the seller's text from ever
  // supplying the delimiter; this stops the delimiter being looked for in the
  // wrong place.
  const pattern = /(!?)\[((?:\\.|[^\]\\])*)\]\(([^)]*)\)|(\*\*)([^*]+)\*\*|(\*)([^*]+)\*/g;

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

      // The scroll container is a second element on purpose. A table that is
      // also its own scroll port has to be both no wider than the phone and as
      // wide as its columns, and it resolves that by staying narrow: every
      // column squeezed to a fifth of a word, prices wrapped over four lines.
      // The wrapper takes the page width, the table takes the width it needs.
      const scroll = document.createElement("div");
      scroll.className = "table-scroll";
      // A region that scrolls has to be reachable by keyboard, or the columns
      // past the edge of a phone are readable with a finger and unreachable
      // without one. WCAG 2.1.1, and axe's `scrollable-region-focusable`.
      //
      // Found by the menu file gate, which is the first thing in this project
      // to run axe over a laid out page: jsdom reports no overflow, so the app
      // gate cannot see this, and the contrast gate runs only the one rule. It
      // was true of the preview too, which is why the fix is here rather than
      // in the exporter.
      scroll.tabIndex = 0;
      scroll.append(table);
      out.append(scroll);
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
