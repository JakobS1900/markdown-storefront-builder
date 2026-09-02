/// <reference types="vite/client" />
/**
 * The starting points, discovered rather than listed.
 *
 * Adding one is dropping two files into this directory. Nothing here changes,
 * no list is edited, and `app/tests/starters.test.ts` gates the new one on the
 * day it lands.
 *
 * Two files rather than one self-describing file, because a file cannot be read
 * for its label without being loaded. The metas are eager, since the picker
 * has to show every label before anything is chosen; the documents are lazy, so
 * each is its own chunk and none is downloaded until somebody picks it.
 * Measured on 2026-09-02: the one-file version emitted no lazy chunks at all
 * and put every payload in the main bundle. The reasoning is in
 * `specs/021-starting-points/spec.md` under "Why two files, measured".
 */
import type { Document } from "@mdsb/engine";

interface Meta {
  readonly label: string;
  readonly description: string;
}

export interface Starter {
  /** The shared filename stem, for example `art-commissions`. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly load: () => Promise<Document>;
}

const META_SUFFIX = ".meta.ts";

const metas = import.meta.glob<Meta>("./*.meta.ts", { eager: true, import: "meta" });
const documents = import.meta.glob<Document>("./*.json", { import: "default" });

/**
 * Sorted by id rather than by label, and deliberately not with
 * `localeCompare`, which answers differently depending on where the browser
 * thinks it is. The order a person sees should not depend on that.
 */
export const STARTERS: readonly Starter[] = Object.entries(metas)
  .flatMap(([path, meta]) => {
    const id = path.slice("./".length, -META_SUFFIX.length);
    const load = documents[`./${id}.json`];
    // A meta with no document beside it is a half-added starting point. It is
    // dropped here rather than thrown, so that specific mistake cannot stop
    // the app from opening, and the test above fails loudly instead. This does
    // not cover every mistake in this directory: a `.meta.ts` with a
    // wrong-shaped `meta` export still produces an entry, reading "undefined"
    // in the picker, which `app/tests/starters.test.ts` now gates on.
    return load === undefined ? [] : [{ id, label: meta.label, description: meta.description, load }];
  })
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
