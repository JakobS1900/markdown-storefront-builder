/**
 * Turning runs of pasted page text into proposed sections.
 *
 * This is still pure reader work: no DOM, no storage, no ids. The proposal
 * keeps `source` as the one fact every later decision rereads, so a seller can
 * swap Text and Prices without converting one guess into another.
 */
import { describe, expect, it } from "vitest";

import {
  buildProposedBlock,
  readProposal,
  swapProposalKind,
  type Proposal,
  type ProposedBlock,
} from "../src/page-text.js";

function kinds(text: string): readonly string[] {
  return readProposal(text).sections.map((section) => section.kind);
}

function firstBlock(text: string): ProposedBlock {
  const section = readProposal(text).sections[0];
  if (section === undefined) throw new Error("no proposed section");
  return buildProposedBlock(section);
}

function onlyMenu(text: string): Extract<ProposedBlock, { kind: "menu" }> {
  const block = firstBlock(text);
  if (block.kind !== "menu") throw new Error(`not a menu: ${block.kind}`);
  return block;
}

function sectionSources(proposal: Proposal): readonly string[] {
  return proposal.sections.map((section) => section.source);
}

describe("proposing sections from a pasted page", () => {
  it("turns a run of product lines into one Prices proposal rather than one per line", () => {
    const proposal = readProposal("Sketch - 30\nFull colour - 80\nCustom piece - DM me");

    expect(proposal.sections).toHaveLength(1);
    expect(proposal.sections[0]?.kind).toBe("menu");
    expect(onlyMenu("Sketch - 30\nFull colour - 80\nCustom piece - DM me").tiers.map((tier) => tier.name)).toEqual([
      "Sketch",
      "Full colour",
      "Custom piece",
    ]);
  });

  it("keeps a note line inside a mostly Prices proposal rather than dropping it", () => {
    const menu = onlyMenu("Sticker - 5\nBadge - 7\nMessage me first");

    expect(menu.tiers).toEqual([
      { name: "Sticker", price: "5" },
      { name: "Badge", price: "7" },
      { name: "Message me first", price: "" },
    ]);
  });

  it("reads the spec example as Heading, Text, Divider, then Prices with thirty rows", () => {
    const rows = Array.from({ length: 30 }, (_, i) => `Print ${String(i + 1)}\t${String((i + 1) * 5)}`).join("\n");
    const page = ["# Willow's Prints", "", "Postage is 5 flat, and I post on Mondays.", "", "---", "", "## Prints", rows].join(
      "\n",
    );
    const proposal = readProposal(page);

    expect(proposal.sections.map((section) => section.kind)).toEqual(["heading", "prose", "divider", "menu"]);
    const last = proposal.sections.at(-1);
    expect(last === undefined ? undefined : buildProposedBlock(last)).toMatchObject({
      kind: "menu",
      heading: "Prints",
      tiers: expect.arrayContaining([{ name: "Print 1", price: "5" }]),
    });
    expect(last === undefined ? [] : (buildProposedBlock(last) as Extract<ProposedBlock, { kind: "menu" }>).tiers).toHaveLength(30);
  });

  it("infers the delimiter from the product run, not from comma heavy prose elsewhere in the paste", () => {
    const page = [
      "I post on Mondays, usually.",
      "Please message me, not the old account.",
      "Local pickup is fine, but ask first.",
      "Commissions are open, for now.",
      "",
      "Sticker\t5",
      "Badge\t7",
      "Print\t12",
    ].join("\n");

    const menu = readProposal(page).sections.filter((section) => section.kind === "menu").at(-1);
    if (menu === undefined) throw new Error("no menu proposal");

    const block = buildProposedBlock(menu);
    if (block.kind !== "menu") throw new Error("not a menu");
    expect(block.tiers).toEqual([
      { name: "Sticker", price: "5" },
      { name: "Badge", price: "7" },
      { name: "Print", price: "12" },
    ]);
  });

  it("absorbs a heading directly above prices into the Prices section source and heading", () => {
    const proposal = readProposal("## Prints\nSketch - 30\nFull colour - 80");

    expect(proposal.sections).toHaveLength(1);
    expect(proposal.sections[0]?.source).toBe("## Prints\nSketch - 30\nFull colour - 80");

    const block = firstBlock("## Prints\nSketch - 30\nFull colour - 80");
    expect(block).toMatchObject({ kind: "menu", heading: "Prints" });
  });

  it("does not absorb a heading into prose", () => {
    expect(kinds("## Terms\nHalf up front.\nI post on Mondays.")).toEqual(["heading", "prose"]);
  });

  it("uses the first nonblank heading as the private title without consuming the heading section", () => {
    const proposal = readProposal("\n# Willow's Prints\n\nWelcome in.");

    expect(proposal.title).toBe("Willow's Prints");
    expect(proposal.sections.map((section) => section.kind)).toEqual(["heading", "prose"]);
    expect(buildProposedBlock(proposal.sections[0] ?? { kind: "divider", source: "", from: 0, to: 0, swappable: false })).toMatchObject({
      kind: "heading",
      text: "Willow's Prints",
      level: 1,
    });
  });

  it("keeps inline marks verbatim in Text sections", () => {
    const text = "**bold**\n*italic*\n[text](https://example.test)\n~~strike~~\n==highlight==";

    expect(firstBlock(text)).toEqual({ kind: "prose", text });
  });

  it("keeps prices the app cannot read as numbers exactly as written", () => {
    const menu = onlyMenu("Custom piece - DM me\nSticker - from 45\nRush fee - 45+");

    expect(menu.tiers.map((tier) => tier.price)).toEqual(["DM me", "from 45", "45+"]);
  });

  it("drops supplier cost on this path and never invents device picture fields", () => {
    const menu = onlyMenu("Bananas, 12, per lb, 4\nApples, 8, each, 2");

    expect(menu.tiers).toEqual([
      { name: "Bananas", price: "12", unit: "per lb" },
      { name: "Apples", price: "8", unit: "each" },
    ]);
    for (const tier of menu.tiers) {
      expect("cost" in tier).toBe(false);
      expect("localImageIds" in tier).toBe(false);
    }
    expect(JSON.stringify(menu)).not.toContain("localAvatarId");
  });

  it("keeps a public extra numeric column as Text rather than guessing it is private cost", () => {
    const text = "Sketch, 30, 10 slots\nIcon, 12, 2 slots";

    expect(kinds(text)).toEqual(["prose"]);
    expect(firstBlock(text)).toEqual({ kind: "prose", text });
  });

  it("leaves image links and contact blocks as Text rather than Gallery or About you", () => {
    const page = [
      "![A3 print](https://example.test/a3.png)",
      "![A4 print](https://example.test/a4.png)",
      "",
      "Discord willow1234",
      "Telegram willow5",
      "Reply before 5pm",
    ].join("\n");
    const proposal = readProposal(page);

    expect(proposal.sections.map((section) => section.kind)).toEqual(["prose", "prose"]);
    expect(proposal.sections.map((section) => section.kind)).not.toContain("gallery");
    expect(proposal.sections.map((section) => section.kind)).not.toContain("profile");
    expect(sectionSources(proposal)).toEqual([
      "![A3 print](https://example.test/a3.png)\n![A4 print](https://example.test/a4.png)",
      "\nDiscord willow1234\nTelegram willow5\nReply before 5pm",
    ]);
  });

  it("swaps Text and Prices by rereading source, so swapping back returns the original proposal", () => {
    const textSection = readProposal("Sketch - 30").sections[0];
    if (textSection === undefined) throw new Error("no text proposal");
    expect(textSection.kind).toBe("prose");

    const asMenu = swapProposalKind(textSection);
    expect(asMenu.kind).toBe("menu");
    expect(buildProposedBlock(asMenu)).toMatchObject({ kind: "menu", tiers: [{ name: "Sketch", price: "30" }] });
    expect(swapProposalKind(asMenu)).toEqual(textSection);

    const menuSection = readProposal("Sketch - 30\nFull colour - 80").sections[0];
    if (menuSection === undefined) throw new Error("no menu proposal");
    expect(menuSection.kind).toBe("menu");

    const asText = swapProposalKind(menuSection);
    expect(asText.kind).toBe("prose");
    expect(buildProposedBlock(asText)).toEqual({ kind: "prose", text: menuSection.source });
    expect(swapProposalKind(asText)).toEqual(menuSection);
  });
});
