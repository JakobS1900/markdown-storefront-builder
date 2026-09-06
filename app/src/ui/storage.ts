/**
 * What the pictures on this device cost, and how to remove one.
 *
 * FR-087 and research D6. The whole design is one rule: nothing here removes
 * anything unless the seller says so, in as many words, about one picture.
 * There is no "clear unused pictures", no cleanup on save, and no reclaiming
 * space to make room for something else. A picture nothing points at is not
 * rubbish; it is a picture the seller may be about to use again, and deleting
 * it on a heuristic is the recovery Principle V forbids.
 *
 * The cost of that rule is real and is stated to the seller rather than hidden:
 * removing a picture from a page leaves its bytes here until they clear it
 * themselves, which is what this panel is for.
 *
 * It reads the records rather than the pictures. `bytes` is denormalised in the
 * store precisely so that totalling what everything costs does not mean decoding
 * every photograph on the device to draw one number.
 *
 * Filled in when it is opened rather than on every repaint. It sits on the Copy
 * tab, which rebuilds itself on a keystroke, and reading the whole store each
 * time would be work nobody asked for.
 */
import { assetCosts, describeBytes, removeAsset, type AssetCost } from "../assets.js";
import { announce, button, el } from "./dom.js";

/** The panel's own id, so the shell can put it back open after a repaint. */
const PANEL_ID = "device-pictures";

/**
 * A picture, named for the seller.
 *
 * Numbered, not named after a file. Nothing here stores the original filename:
 * it is one of the things `normalise()` discards, and FR-081 wants it out of
 * anything a seller might screenshot anyway. The position in a list ordered
 * newest first is what somebody can actually match against what they just
 * added.
 */
function pictureName(at: number, of: number): string {
  return `picture ${at + 1} of ${of}`;
}

function row(cost: AssetCost, at: number, of: number, refresh: () => void): HTMLElement {
  const name = pictureName(at, of);
  const item = el("li", { class: "stored-picture" });

  const ask = (): void => {
    // A question, not a dialog. Removing a picture cannot be undone, and there
    // is no second copy anywhere, so this is one of the few places in this app
    // that asks before acting rather than offering the act back afterwards.
    item.replaceChildren(
      el("p", {}, [
        `Remove ${name}? It is deleted from this device and cannot be brought back. Any page using it will show a note instead of the picture.`,
      ]),
      el("div", { class: "adders" }, [
        button({
          label: `Remove ${name} permanently`,
          variant: "danger",
          onClick: () => {
            void removeAsset(cost.id).then(() => {
              announce(`Removed ${name}.`);
              refresh();
            });
          },
        }),
        button({ label: `Keep ${name}`, onClick: () => item.replaceChildren(...resting()) }),
      ]),
    );
  };

  const resting = (): Node[] => [
    el("span", { class: "stored-picture-name" }, [
      `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${describeBytes(cost.bytes)}`,
    ]),
    button({ label: `Remove ${name}`, variant: "danger", onClick: ask }),
  ];

  item.replaceChildren(...resting());
  return item;
}

export function storagePanel(): HTMLElement {
  const body = el("div", { class: "more-body" }, [
    el("p", { class: "hint" }, ["Reading what your pictures use."]),
  ]);

  const panel = el("details", { class: "more device-pictures", id: PANEL_ID }, [
    el("summary", {}, ["Pictures on this device"]),
    body,
  ]) as HTMLDetailsElement;

  const fill = (): void => {
    void assetCosts()
      .then((costs) => {
        if (costs.length === 0) {
          body.replaceChildren(
            el("p", { class: "hint" }, [
              "You have not added any pictures from this device yet. When you do, what each one uses will be listed here.",
            ]),
          );
          return;
        }

        const total = costs.reduce((sum, cost) => sum + cost.bytes, 0);
        body.replaceChildren(
          el("p", { class: "hint" }, [
            `${costs.length} picture${costs.length === 1 ? "" : "s"} on this device, using ${describeBytes(total)} in total. Nothing is ever removed for you, so a picture stays here until you remove it, even after you take it off a page.`,
          ]),
          el(
            "ul",
            { class: "stored-pictures", "aria-label": "Pictures stored on this device" },
            costs.map((cost, at) => row(cost, at, costs.length, fill)),
          ),
        );
      })
      .catch(() => {
        body.replaceChildren(
          el("p", { class: "hint" }, [
            "This browser would not say what your pictures use. Nothing has been changed, and your pictures are still here.",
          ]),
        );
      });
  };

  // Filled when it is opened, and that includes the shell reopening it after a
  // repaint: setting `open` fires this event too, so a panel the seller had
  // open comes back with its contents rather than with the placeholder.
  panel.addEventListener("toggle", () => {
    if (panel.open) fill();
  });

  return panel;
}
