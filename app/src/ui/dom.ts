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
  disabled?: boolean;
  controls?: string;
}): HTMLButtonElement {
  const node = el(
    "button",
    {
      type: "button",
      class: `btn ${opts.variant ?? "ghost"}${opts.glyph !== undefined ? " icon" : ""}`,
      "aria-pressed": opts.pressed === undefined ? undefined : String(opts.pressed),
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
    control,
  ]);
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
 * The point is what an artist meets first. A section that opens with five
 * fields, three of them optional, reads as a form to be completed. The same
 * section opening with two reads as a thing to be filled in.
 */
export function disclosure(opts: { summary: string; children: Node[] }): HTMLElement {
  return el("details", { class: "more", id: nextFieldId() }, [
    el("summary", {}, [opts.summary]),
    el("div", { class: "more-body" }, opts.children),
  ]);
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
