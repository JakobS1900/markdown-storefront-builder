/**
 * Version 3 to 4: the contract learns about pictures held on the seller's own
 * device, and a page saved at version 3 must not notice.
 *
 * The step is the smallest a migration can be. It stamps the version and does
 * nothing else, because the three fields it makes room for are all optional and
 * an absent optional field is never defaulted into existence. See the version 2
 * to 3 test below for why that rule is load bearing rather than tidy.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compile, parseDocument, SCHEMA_VERSION, TARGETS } from "@mdsb/engine";
import type { Document } from "@mdsb/engine";

// Not part of the public surface (see `document/index.ts`), imported directly
// so this step's own non-mutation can be checked in isolation. Going through
// `parseDocument` alone would only ever hand this step the intermediate object
// the earlier steps just built, which nothing holds a reference to, so a
// mutation here could not be told apart from one committed earlier in the
// chain.
import { migrate } from "../../src/document/migrate.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

/** The fixture exactly as it sits on disk, at version 3 and unmigrated. */
function rawV3(): Record<string, unknown> {
  return JSON.parse(fixture("v3-page.json")) as Record<string, unknown>;
}

function migratedV3(): Document {
  const result = parseDocument(fixture("v3-page.json"));
  if (!result.ok) throw new Error(`v3 fixture did not migrate: ${JSON.stringify(result.issues)}`);
  return result.document;
}

describe("a page saved at version 3", () => {
  it("comes forward to the current version", () => {
    const result = parseDocument(fixture("v3-page.json"));
    expect(result.ok ? result.document.schemaVersion : result.issues).toBe(SCHEMA_VERSION);
  });

  it("gives no row a list of local pictures, because absent and empty are different", () => {
    // The same rule the version 1 and version 2 migrations follow for
    // `imageUrl` and `cost`: an absent optional field is never defaulted into
    // existence, or round tripping would depend on which representation the
    // writer happened to pick.
    const first = migratedV3().blocks[0];
    if (first === undefined || first.kind !== "menu") throw new Error("expected a menu first");
    expect(first.tiers.every((tier) => !("localImageIds" in tier))).toBe(true);
  });

  it("gives no gallery item a local picture", () => {
    const gallery = migratedV3().blocks[1];
    if (gallery === undefined || gallery.kind !== "gallery") throw new Error("expected a gallery second");
    expect(gallery.items.every((item) => !("localImageId" in item))).toBe(true);
  });

  it("gives no profile a local avatar", () => {
    const profile = migratedV3().blocks[2];
    if (profile === undefined || profile.kind !== "profile") throw new Error("expected a profile third");
    expect("localAvatarId" in profile).toBe(false);
  });

  it("keeps every field it already had, with the value it already had", () => {
    // Symmetric on purpose. It fails if a field is lost and it fails if one is
    // invented, which is the pair of things this step must not do. The version
    // stamp is the only thing it may change, so it is the only thing excluded.
    const raw = rawV3();
    const migrated = migratedV3() as unknown as Record<string, unknown>;

    expect(migrated["blocks"]).toEqual(raw["blocks"]);
    expect(migrated["target"]).toBe(raw["target"]);
    expect(migrated["title"]).toBe(raw["title"]);
    expect(Object.keys(migrated).sort()).toEqual(Object.keys(raw).sort());
  });

  it("does not mutate the page it was given", () => {
    // Calling `migrate` with `from: 3` runs only the step whose `from` is at
    // least 3, so this proves that step itself does not write into its input,
    // not just that the pipeline as a whole does not.
    const v3 = rawV3();
    const before = JSON.stringify(v3);
    migrate(v3, 3);
    expect(JSON.stringify(v3)).toBe(before);
  });
});

/**
 * SC-008: no seller's published page changes under them.
 *
 * The test above only covers the fields surviving. Nothing else in the suite
 * would catch a migration that preserved every field and still moved a byte of
 * compiled output, which is the thing a seller would actually see.
 *
 * The unmigrated side is reachable because `compile` does not re-validate: it
 * takes the page it is given and emits it, so the raw version 3 object can be
 * compiled exactly as it sits on disk. That is what makes this a real before
 * and after rather than two spellings of the same value.
 */
describe("migrating a version 3 page changes nothing a paste host would show", () => {
  it.each(TARGETS.map((target) => target.id))("%s output is byte identical", (targetId) => {
    const before = compile(rawV3() as unknown as Document, targetId);
    const after = compile(migratedV3(), targetId);

    expect(after.markdown).toBe(before.markdown);
    expect(after.diagnostics).toEqual(before.diagnostics);

    // Proving the comparison above is not two empty strings, and proving it
    // PER TARGET rather than once.
    //
    // This started as a separate case that checked only the first target, which
    // left the other two able to pass by comparing nothing to nothing. That is
    // the precise failure mode the check exists to prevent, reintroduced by the
    // check itself, and a reviewer caught it. A guard that does not cover
    // everything the sweep covers is not a guard, it is a sample.
    expect(after.markdown).toContain("Small");
    expect(after.markdown.length).toBeGreaterThan(100);
  });
});
