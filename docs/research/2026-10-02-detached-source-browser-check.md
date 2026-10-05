# Detached source browser check, 2026-10-02

## First pass, feature branch at `a5c3499`

I opened the built app in a fresh isolated headless Chrome profile and used the import panel at 320 and 390 CSS pixels. The fictional source had `# Figures`, then `Maker note` and `Arrow Orb` in one Text section before an empty Item, Amount, Price table. `Arrow Vase` followed another two-row table. `# Prints`, `Arrow Kite`, and `Arrow Wing` followed the same pattern. The eight amount-price pairs were 12 oz/$25, 16 oz/$32, 20 oz/$40, 24 oz/$48, 8 in/$15, 12 in/$22, 16 in/$30, and 20 in/$36.

I assigned the three table columns in each of the four tables. For each table I used the exact preceding item-name source row for both included offers, and the relevant heading source row as its Prices category. The controls named the original source row, showed the resulting name or category, and said they would change two included price rows. The page offered Add with three output sections: one retained Text note and two Prices sections.

After Add, Build showed `Maker note`, `Figures, 2 items`, and `Prints, 2 items`. Opening the two Prices sections showed Arrow Orb and Arrow Vase under Figures, Arrow Kite and Arrow Wing under Prints, and all eight amount-price pairs in their quantity fields. Preview's rendered page had headings `Figures`, `Arrow Orb`, `Arrow Vase`, `Prints`, `Arrow Kite`, `Arrow Wing` in that order, once each. Copy contained the note, those headings, and all eight table rows. At both widths `document.documentElement.scrollWidth` equaled `clientWidth`, 320 and 390 respectively. Chrome reported zero runtime exceptions.

[Source choice at 320 pixels](media/2026-10-02-detached-choice-320.png), [source choice at 390 pixels](media/2026-10-02-detached-choice-390.png), [saved Preview at 320 pixels](media/2026-10-02-detached-preview-320.png), and [saved Preview at 390 pixels](media/2026-10-02-detached-preview-390.png) show the observed screens.

## Final pass after holistic fixes

I rebuilt the corrected branch and repeated the full UI task in a fresh Chrome profile at 320 CSS pixels. I mapped Item, Amount and Price on all four tables, then used each exact nearby name and heading with the panel's Use controls. The four tables offered source rows 4 and 1, 11 and 1, 20 and 18, and 27 and 18 respectively. Add was enabled for three output sections. After Add, Build showed `Maker note`, `Figures, 2 items`, and `Prints, 2 items`.

In the first rendered Preview, the headings were `Figures`, `Arrow Orb`, `Arrow Vase`, `Prints`, `Arrow Kite`, `Arrow Wing`, each once. Preview displayed all eight amount-price pairs in the intended item and category order. Copy contained each heading once and all eight rows, with dollar signs escaped as `&#36;` for rentry.co. At 320 and 390 CSS pixels, document width equaled viewport width. Chrome recorded no runtime exception. The two Preview screenshots linked above were recaptured from this final build; the source-choice screenshots show the same controls from the first pass.

The later holistic regression for `Figures -> unheaded other menu -> Figures` is covered by a failing-first pure test. This UI task has two headed categories, so the regression test supplies the separate evidence for that edge.
