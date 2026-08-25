/**
 * An address field for an image, with a live preview and honest status.
 *
 * Roadmap 3.1. This ships before any upload path, so the gallery is usable with
 * no server at all, and it stays usable if the upload service is ever switched
 * off.
 *
 * The problem it solves is specific. These hosts do not store images, so every
 * image on an artist's page is a link to somewhere else. A dead link is the
 * single most common way one of these pages rots, and the artist has no way to
 * know unless something tells them. Finding out from a client is worse.
 *
 * It uses the engine's own `isSafeUrl` rather than its own copy of the rule. If
 * the two disagreed, the app would tell an artist their image is fine while the
 * compiler quietly drops it.
 */
import { isSafeUrl } from "@mdsb/engine";

import { uploadConfigured, uploadImage } from "../upload.js";
import { announce, button, el } from "./dom.js";

type Status = "empty" | "unsafe" | "checking" | "ok" | "broken";

const MESSAGE: Record<Status, string> = {
  empty: "",
  unsafe: "This needs to be a web address starting with https://. Other kinds of address are not safe to publish, so this image would be left out.",
  checking: "Checking that the image loads.",
  ok: "This image loads.",
  broken: "This address did not load an image. It may have been moved or deleted, or the site may block other pages from showing it.",
};

let counter = 0;

export function imageField(opts: {
  label: string;
  value: string;
  hint?: string;
  onInput: (value: string) => void;
}): HTMLElement {
  counter += 1;
  const id = `img${counter}`;
  const statusId = `${id}-status`;
  const hintId = `${id}-hint`;

  const input = el("input", {
    id,
    type: "url",
    inputmode: "url",
    autocapitalize: "none",
    spellcheck: "false",
    "aria-describedby": `${hintId} ${statusId}`,
  }) as HTMLInputElement;
  input.value = opts.value;

  const thumb = el("img", { class: "thumb", alt: "" }) as HTMLImageElement;
  const frame = el("div", { class: "thumb-frame", hidden: true }, [thumb]);

  // Not a live region. It updates on every keystroke, and an assistive
  // technology reading each intermediate state aloud would be unusable. The
  // settled result is announced deliberately instead.
  const status = el("p", { class: "img-status", id: statusId });

  let token = 0;

  function paint(next: Status, announceIt: boolean): void {
    status.textContent = MESSAGE[next];
    status.className = `img-status ${next}`;
    frame.toggleAttribute("hidden", next !== "ok");
    if (announceIt && MESSAGE[next] !== "") announce(MESSAGE[next]);
  }

  function check(): void {
    const url = input.value.trim();
    token += 1;
    const mine = token;

    if (url === "") {
      paint("empty", false);
      return;
    }

    if (!isSafeUrl(url)) {
      // Anything non-empty that is not safe is flagged, with no attempt to guess
      // whether the artist is still typing.
      //
      // An earlier version only warned about addresses that already looked like
      // a partial http one, on the theory that warning mid-keystroke was noise.
      // The effect was that "javascript:alert(1)" produced no warning at all,
      // because it does not look like a half-typed web address. Exactly the case
      // most worth flagging was the one that stayed silent.
      //
      // The keystroke concern is handled by only checking on blur, so by the
      // time this runs the artist has moved on and a warning is what they want.
      paint("unsafe", true);
      return;
    }

    paint("checking", false);

    // Loading the image is the only honest test. A HEAD request would be
    // blocked by cross-origin rules on most hosts, and a host that serves the
    // bytes but forbids hotlinking looks fine to a fetch and broken in an
    // <img>, which is exactly the case that matters here.
    const probe = new Image();
    probe.onload = () => {
      if (mine !== token) return;
      thumb.src = url;
      paint("ok", true);
    };
    probe.onerror = () => {
      if (mine !== token) return;
      paint("broken", true);
    };
    probe.src = url;
  }

  input.addEventListener("input", () => {
    opts.onInput(input.value);
    paint("empty", false);
  });
  // Checked on blur rather than per keystroke, so a half-typed address does not
  // fire a request, and the artist is not told their image is broken while they
  // are still typing it.
  input.addEventListener("blur", check);

  if (opts.value !== "") check();

  /**
   * The upload control, or nothing.
   *
   * Absent entirely when this build has no Imgur Client-ID, rather than present
   * and broken. Address entry shipped first precisely so this could be
   * optional.
   */
  const uploader: Node[] = [];
  if (uploadConfigured()) {
    // Hidden from assistive technology and from the tab order, deliberately
    // and as a pair. The button below is the real control: it is what has a
    // name, what takes focus, and what a screen reader announces. This input
    // exists only because a file dialog cannot be opened any other way.
    //
    // Leaving it exposed would offer two controls for one action, the second
    // of them unlabelled. Hiding it from the a11y tree while leaving it
    // tabbable would be worse still: focus would land on something a screen
    // reader refuses to describe. So both attributes go on together, and the
    // a11y gate enforces that pairing rather than trusting this comment.
    const picker = el("input", {
      id: `${id}-file`,
      type: "file",
      accept: "image/png,image/jpeg,image/gif,image/webp",
      class: "sr-only",
      "aria-hidden": "true",
      tabindex: "-1",
    }) as HTMLInputElement;

    const pick = button({
      label: "Upload a picture from this device",
      onClick: () => picker.click(),
    });

    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      if (file === undefined) return;

      paint("checking", false);
      status.textContent = "Uploading to Imgur.";
      announce("Uploading to Imgur.");
      pick.disabled = true;

      void uploadImage(file)
        .then((outcome) => {
          if (outcome.ok && outcome.url !== undefined) {
            input.value = outcome.url;
            opts.onInput(outcome.url);
            check();
          } else {
            paint("broken", false);
            status.textContent = outcome.message ?? "That upload did not work.";
            announce(status.textContent);
          }
        })
        .finally(() => {
          pick.disabled = false;
          // Cleared so choosing the same file again still fires a change event.
          picker.value = "";
        });
    });

    uploader.push(el("div", { class: "uploader" }, [pick, picker]));
  }

  return el("div", { class: "field image-field" }, [
    el("label", { for: id }, [opts.label]),
    el("p", { class: "hint", id: hintId }, [
      opts.hint ??
        "Upload a picture, or paste the address of one already online. Your page links to the image, so if it is deleted or moved, it stops showing.",
    ]),
    input,
    ...uploader,
    status,
    frame,
  ]);
}
