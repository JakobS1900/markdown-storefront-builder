/**
 * The small set of primitives every screen is built from.
 *
 * Accessibility lives here rather than in each screen. Constitution Principle
 * VI requires every interactive control to have an accessible name, a 44 by 44
 * pixel touch target, and keyboard operation. Making that the property of the
 * primitives means a new screen gets it by default, and a screen that skips it
 * has to work at doing so.
 *
 * The users are non-technical people on phones. A keyboard-only, mouse-assumed
 * interface fails exactly the population this exists to serve.
 */

type Attrs = Record<string, string | number | boolean | undefined>;

/**
 * Creates an element.
 *
 * Text is set with `textContent`, never `innerHTML`. Nothing in this
 * application builds DOM from a string, which removes an entire category of
 * bug: there is no path from artist text to markup here at all.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }

  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }

  return node;
}

/**
 * A button.
 *
 * `label` is required and becomes the accessible name, so a button without one
 * cannot be created. Icon-only buttons pass a visible symbol as `glyph` and
 * still carry the label, which is the case most often got wrong.
 */
export function button(opts: {
  label: string;
  onClick: () => void;
  glyph?: string;
  variant?: "primary" | "ghost" | "danger";
  pressed?: boolean;
  /**
   * For a button that shows and hides a region, rather than one that is on or
   * off. The two are announced differently and are not interchangeable:
   * "expanded" tells someone the thing they are looking for is now on screen,
   * "pressed" tells them a setting changed. Pass `controls` with it, naming the
   * region, or the announcement has nothing to point at.
   */
  expanded?: boolean;
  disabled?: boolean;
  controls?: string;
}): HTMLButtonElement {
  const node = el(
    "button",
    {
      type: "button",
      class: `btn ${opts.variant ?? "ghost"}${opts.glyph !== undefined ? " icon" : ""}`,
      "aria-pressed": opts.pressed === undefined ? undefined : String(opts.pressed),
      "aria-expanded": opts.expanded === undefined ? undefined : String(opts.expanded),
      "aria-controls": opts.controls,
      "aria-label": opts.glyph !== undefined ? opts.label : undefined,
      disabled: opts.disabled,
    },
    [opts.glyph ?? opts.label],
  );

  node.addEventListener("click", opts.onClick);
  return node;
}

/**
 * Ids for form controls, numbered per render rather than for the life of the
 * page.
 *
 * They used to climb forever, so every repaint renamed every field: `f7`
 * became `f19` became `f31`. Within one render that is invisible, because the
 * label and its control are minted together and agree, which is why the
 * accessibility gate never objected. Across a render it means no control can
 * be followed. The app rebuilds its whole DOM on every keystroke, so after the
 * first character the field being typed into no longer exists and nothing can
 * work out where it went. Focus was lost, and on a phone the keyboard closed
 * with it: a person typed one letter, reopened the field, and typed the next.
 *
 * Resetting per render makes an id a function of the shape of the page, so the
 * same field keeps the same id for as long as the shape holds still, which is
 * exactly the case that matters. Typing changes values, never structure.
 *
 * The shape can change, and then an id can legitimately refer to a different
 * field. Restoring focus therefore checks the label as well as the id, and
 * declines rather than guessing.
 */
let fieldCounter = 0;

export function resetFieldIds(): void {
  fieldCounter = 0;
}

export function nextFieldId(): string {
  fieldCounter += 1;
  return `f${fieldCounter}`;
}

/**
 * A labelled text field.
 *
 * The label is a real `<label>` bound by id, not a placeholder. Placeholders
 * disappear on focus, are invisible to some assistive technology, and fail
 * anyone who looks away mid-sentence.
 */
export function field(opts: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  inputMode?: string;
  /**
   * Offer the formatting buttons above this field.
   *
   * Opt in, and it must stay opt in. `formatInline` is called from exactly one
   * place in the engine, the text section emitter, so this is the only field in
   * the application whose contents can carry formatting. Every other multiline
   * field here is a line-oriented list that is published as plain text, and a
   * Bold button on one of those would promise something the compiler refuses.
   *
   * The string is what the buttons are named after, so a page with three text
   * sections does not give a screen reader three identical "Bold" buttons. Same
   * problem and same answer as `rowTools` in `forms.ts`.
   */
  formatting?: string;
}): HTMLElement {
  const id = nextFieldId();
  const hintId = `${id}-hint`;

  const control = opts.multiline === true
    ? el("textarea", { id, rows: 5, "aria-describedby": opts.hint === undefined ? undefined : hintId })
    : el("input", {
        id,
        type: "text",
        inputmode: opts.inputMode,
        "aria-describedby": opts.hint === undefined ? undefined : hintId,
      });

  (control as HTMLInputElement | HTMLTextAreaElement).value = opts.value;
  control.addEventListener("input", () => {
    opts.onInput((control as HTMLInputElement | HTMLTextAreaElement).value);
  });

  return el("div", { class: "field" }, [
    el("label", { for: id }, [opts.label]),
    ...(opts.hint === undefined ? [] : [el("p", { class: "hint", id: hintId }, [opts.hint])]),
    ...(opts.formatting === undefined
      ? []
      : [formattingBar(control as HTMLTextAreaElement, opts.formatting)]),
    control,
  ]);
}

/**
 * What each button does to the selection.
 *
 * `wrap` puts its marker on both sides. `line` toggles a prefix on every line
 * the selection touches. `link` is its own shape because it needs somewhere to
 * put an address.
 *
 * The markers are the ones the engine's grammar recognises, and that is the
 * whole design: this writes what a seller could have typed, so there is no
 * second way for formatting to reach a document and nothing here that the
 * compiler does not already understand. A button for something outside the
 * whitelist would produce text, which is exactly what should happen.
 */
const FORMATS = [
  { key: "bold", label: "Bold", glyph: "B", wrap: "**", placeholder: "bold text" },
  { key: "italic", label: "Italic", glyph: "I", wrap: "*", placeholder: "italic text" },
  { key: "strike", label: "Cross out", glyph: "S", wrap: "~~", placeholder: "crossed out" },
  { key: "highlight", label: "Highlight", glyph: "H", wrap: "==", placeholder: "highlighted" },
  // WORDS, NOT SYMBOLS, AND THE CONTRAST GATE IS WHY.
  //
  // These two were a chain emoji and a bullet character. The gate drew all six
  // and reported that axe had read a colour out of only four: it returns no
  // result at all for these, in both palettes, so their contrast was a claim
  // nobody had checked. The four letters beside them were measured fine.
  //
  // A short word is measurable, needs no legend, and survives a font that has
  // no glyph for a symbol. The cost is two wider buttons, which the row wraps
  // for at narrow widths anyway.
  { key: "link", label: "Link", glyph: "Link", placeholder: "link text" },
  { key: "list", label: "Bullet list", glyph: "List", line: "- ", placeholder: "first thing" },
] as const;

/**
 * The formatting buttons, and the three traps they are built around.
 *
 * ONE: a click blurs the field, and a blur repaints. `typing()` in `store.ts`
 * is true only while a text field holds focus, and `repaint()` defers entirely
 * while it is. An ordinary button click flips that false, the repaint lands
 * mid-edit, and `render` calls `replaceChildren`, destroying the textarea under
 * the seller's hands. `preventDefault` on `mousedown` is what stops it: focus
 * never leaves, so the selection is still there when the handler runs.
 *
 * TWO: the change goes back through the listener `field` already installed,
 * by dispatching `input`. Not by calling the store. This feature therefore adds
 * no second path by which prose reaches a document, which matters because there
 * is exactly one today and every guarantee about undo and repainting hangs off
 * it.
 *
 * THREE: it edits the live control. A field reference does not survive a
 * repaint, so nothing here is captured and reused later.
 */
function formattingBar(control: HTMLTextAreaElement, within: string): HTMLElement {
  return el(
    "div",
    { class: "format-bar", role: "group", "aria-label": `Formatting for ${within}` },
    FORMATS.map((format) => {
      const node = button({
        // Named for the field it acts on. Three text sections on one page
        // otherwise offer a screen reader three buttons called "Bold" with
        // nothing to tell them apart.
        label: `${format.label}, in ${within}`,
        glyph: format.glyph,
        onClick: () => {
          apply(control, format);
          // The one line that makes this a change rather than a redrawn box.
          control.dispatchEvent(new Event("input", { bubbles: true }));
        },
      });
      // Keeps the caret where the seller left it. Without this the button takes
      // focus, the field loses it, and the repaint that follows replaces the
      // element being typed into.
      node.addEventListener("mousedown", (event) => event.preventDefault());
      return node;
    }),
  );
}

/** Applies one format to whatever the seller has selected. */
function apply(control: HTMLTextAreaElement, format: (typeof FORMATS)[number]): void {
  const value = control.value;
  const from = control.selectionStart;
  const to = control.selectionEnd;
  const selected = value.slice(from, to);

  if ("line" in format) {
    applyLines(control, format.line, format.placeholder);
    return;
  }

  const body = selected === "" ? format.placeholder : selected;

  if (format.key === "link") {
    // The address is the one thing a button cannot guess, so the caret is left
    // where it goes rather than a placeholder being invented for it.
    const text = `[${body}](`;
    control.value = `${value.slice(0, from)}${text})${value.slice(to)}`;
    const caret = from + text.length;
    control.setSelectionRange(caret, caret);
    return;
  }

  const marker = format.wrap;
  // Pressing the same button again takes the formatting off rather than nesting
  // it. Both shapes count: the markers may be inside the selection, because the
  // seller selected the word after formatting it, or outside it, because they
  // selected only the word between them.
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
    const bare = selected.slice(marker.length, -marker.length);
    control.value = `${value.slice(0, from)}${bare}${value.slice(to)}`;
    control.setSelectionRange(from, from + bare.length);
    return;
  }
  const before = value.slice(Math.max(0, from - marker.length), from);
  const after = value.slice(to, to + marker.length);
  if (before === marker && after === marker) {
    control.value = `${value.slice(0, from - marker.length)}${selected}${value.slice(to + marker.length)}`;
    control.setSelectionRange(from - marker.length, from - marker.length + selected.length);
    return;
  }

  control.value = `${value.slice(0, from)}${marker}${body}${marker}${value.slice(to)}`;
  // The word stays selected, so a second press can undo it and so the seller
  // can see what changed. With nothing selected the placeholder is selected
  // instead, so the next keystroke replaces it rather than joining it.
  control.setSelectionRange(from + marker.length, from + marker.length + body.length);
}

/** Toggles a line prefix on every line the selection touches. */
function applyLines(control: HTMLTextAreaElement, prefix: string, placeholder: string): void {
  const value = control.value;
  // Grown out to whole lines first. A selection that starts mid-word still
  // means "these lines" to the person who made it.
  const start = value.lastIndexOf("\n", Math.max(0, control.selectionStart - 1)) + 1;
  const end = value.indexOf("\n", control.selectionEnd);
  const stop = end === -1 ? value.length : end;

  const block = value.slice(start, stop);
  const lines = block === "" ? [placeholder] : block.split("\n");
  const already = lines.every((line) => line.startsWith(prefix));
  const next = lines
    .map((line) => (already ? line.slice(prefix.length) : `${prefix}${line}`))
    .join("\n");

  control.value = `${value.slice(0, start)}${next}${value.slice(stop)}`;
  control.setSelectionRange(start, start + next.length);
}

/**
 * A labelled checkbox.
 *
 * Its own primitive rather than a variant of `field`: `field` sets its
 * control to `width: 100%` and a 44 pixel min-height meant for a text box, and
 * applying that to a checkbox would stretch it across the row. `.checkbox` in
 * the stylesheet overrides both by specificity rather than duplicating them.
 */
export function checkbox(opts: { label: string; checked: boolean; onChange: (checked: boolean) => void }): HTMLElement {
  const id = nextFieldId();
  const control = el("input", { id, type: "checkbox" }) as HTMLInputElement;
  control.checked = opts.checked;
  control.addEventListener("change", () => opts.onChange(control.checked));

  return el("div", { class: "field checkbox" }, [control, el("label", { for: id }, [opts.label])]);
}

/** A labelled select, for the small closed sets the contract defines. */
export function select(opts: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}): HTMLElement {
  const id = nextFieldId();

  const control = el(
    "select",
    { id },
    opts.options.map((o) => {
      const option = el("option", { value: o.value, selected: o.value === opts.value }, [o.label]);
      return option;
    }),
  );

  control.value = opts.value;
  control.addEventListener("change", () => opts.onChange(control.value));

  return el("div", { class: "field" }, [el("label", { for: id }, [opts.label]), control]);
}

/**
 * A group of secondary fields, folded away until asked for.
 *
 * Native `details`, not a hand-rolled toggle. It is keyboard operable, it is
 * announced as expanded or collapsed without any aria of ours, and it works
 * with no state to keep. The open ones are remembered across a repaint by the
 * shell, which is why this takes an id from the same sequence as the fields.
 *
 * A group that exists once on a surface should pass its own `id` instead. The
 * numbered ones are a function of the shape of the page, which is right for a
 * group belonging to a section and wrong for one that does not: the page list
 * folded itself shut every time a section was opened, because opening a section
 * renders its fields, that moves the counter, and a group the shell cannot find
 * by id comes back closed.
 *
 * The point is what an artist meets first. A section that opens with five
 * fields, three of them optional, reads as a form to be completed. The same
 * section opening with two reads as a thing to be filled in.
 */
export function disclosure(opts: {
  summary: string;
  children: Node[];
  className?: string;
  id?: string;
  /**
   * Start open, for a group whose contents are not empty.
   *
   * Folding is about what somebody meets on a blank row, never about hiding
   * what they already typed. A cost entered and then folded out of sight is
   * worse than the clutter folding removes, and quietly so: bulk pricing reads
   * `cost` off every selected row, so a cost nobody can find is a feature that
   * prices nothing and says it skipped the row.
   *
   * Known wart, stated rather than discovered later. `restoreOpenGroups` in the
   * shell only ever opens a group, never closes one, so while this is true the
   * group cannot be collapsed: closing it works until the next repaint, which
   * builds it open again. Showing somebody their own data is worth more than
   * being able to fold it away, and making close stick means keeping a set of
   * deliberately closed ids across repaints, which is state this does not have.
   */
  open?: boolean;
}): HTMLElement {
  const node = el("details", { class: `more${opts.className === undefined ? "" : ` ${opts.className}`}`, id: opts.id ?? nextFieldId() }, [
    el("summary", {}, [opts.summary]),
    el("div", { class: "more-body" }, opts.children),
  ]) as HTMLDetailsElement;

  if (opts.open === true) node.open = true;
  return node;
}

/** Everything inside a layer that a keyboard can reach. */
function focusable(panel: HTMLElement): HTMLElement[] {
  return [
    ...panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

/**
 * Keeps a keyboard inside one layer while it is open.
 *
 * This is the part `showModal()` would have done. Tab from the last control
 * returns to the first and shift tab from the first goes to the last, so focus
 * cannot walk out into a page the seller cannot see.
 *
 * It is also the guarantee that is actually TESTED. `inert` is set on
 * everything behind a layer, which is the correct thing for a browser, and
 * jsdom implements it neither as a property nor as behaviour: an element inside
 * an inert subtree still takes focus there. Asserting the attribute would be
 * asserting that a word is present, so this containment is what the tests prove
 * and the attribute is what real browsers act on.
 *
 * This was private to `pages-sidebar.ts` until the wizard needed the
 * same trap, and it was moved here rather than copied. A hand written focus
 * trap is exactly the kind of thing that gets fixed in one copy and not the
 * other, and this file is where the docstring at the top already says
 * accessibility belongs: the property of the primitives, so a new screen gets
 * it by default. Both layers' tests exercise it independently.
 */
export function trapFocus(panel: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== "Tab") return;

  const stops = focusable(panel);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) {
    // Nothing to move between, so there is nowhere for Tab to go that is not
    // out. Holding it here is still right: out is the page behind the layer.
    event.preventDefault();
    return;
  }

  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Replaces a container's children. */
export function render(container: HTMLElement, ...children: Node[]): void {
  container.replaceChildren(...children);
}

/**
 * Announces something to assistive technology without stealing focus.
 *
 * Saving, warnings appearing, and a block being deleted are all invisible to a
 * screen reader user otherwise: the change happens somewhere they are not
 * looking, and nothing tells them.
 */
export function announce(message: string): void {
  const region = document.getElementById("live-region");
  if (region === null) return;
  // Clearing first forces a re-announcement when the same message repeats.
  region.textContent = "";
  region.textContent = message;
}
