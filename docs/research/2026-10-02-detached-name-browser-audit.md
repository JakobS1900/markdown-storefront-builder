# Detached name import browser audit, 2026-10-02

## Method

I used the built Phase 3 app at commit `89be001` in an isolated headless Chrome profile with a 320 by 844 CSS pixel viewport. I opened Paste a page and entered fictional source:

```markdown
# Figures

Arrow Orb

| Item | Amount | Price |
| --- | --- | --- |
| | 12 oz | $25 |
| | 16 oz | $32 |
```

I reviewed the table, accepted its Item, Amount and Price column roles, selected both offers, applied the shared name `Arrow Orb`, created a `Figures` Prices category, and pressed Add. I then opened Preview. Browser evaluation reported `document.documentElement.scrollWidth === document.documentElement.clientWidth === 320` and no runtime exception was observed.

## Observed result

Both amount and price pairs remained correct. The saved page also contained the original standalone Heading and Text sections, followed by the new Prices section. Preview rendered `Figures`, `Arrow Orb`, `Figures`, `Arrow Orb`, then the quantity table. The seller must discover and uncheck two original sections before Add to avoid the duplicated heading and item name. This is a poor default for the exact detached-name structure the correction panel is meant to handle.

[Correction panel at 320 CSS pixels](media/2026-10-02-detached-name-correction-320.png) and [saved Preview with duplicates](media/2026-10-02-detached-name-duplicate-preview.png).

The correction panel fits the viewport, but one short source needs a long vertical review: table mapping, two row selections, a shared-name field, a category field, and separate section inclusion checkboxes. This observation concerns one fictional run. It does not establish a measured seller success rate or compare the older build.

## Decision for the combined draft

Treat the duplicate output as a blocking usability finding before marking feature 030 ready for seller sessions. Phase 4 handles undo, source replacement and empty-section recovery. A separate reviewed chunk should offer an explicit way to use a nearby source line as the selected rows' name and a heading as their category. When chosen, the original line must be accounted for as the reviewed item or category instead of also publishing as standalone Text or Heading. Keep an explicit option to retain ambiguous source as Text. Do not silently remove a source line based only on matching words.
