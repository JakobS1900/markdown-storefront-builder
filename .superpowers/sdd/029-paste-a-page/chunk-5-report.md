# Chunk 5 gates

T048 through T051 and T053 are complete. The a11y case opens the page paste panel with three proposed sections and checks every checkbox name. The focused a11y run passed 62 tests. The XSS corpus now sends one hostile whole page paste through proposal, compilation and preview, and checks that script and image markup stay inert. The focused renderer run passed 40 tests.

The browser contrast pass opened the proposal separately in light and dark. `npm run contrast` exited 0. Each palette drew three sections and three checkboxes, axe measured 16 contrast nodes in the panel, and there were zero failures. The pass refuses missing sections, checkboxes or measured nodes.

Both new gates were seen red. Clearing the first section checkbox label made the a11y case fail on its name assertion. Temporarily setting light `--muted` to `#dedede` made contrast exit 1, including the page paste hint at 1.2:1 against the required 4.5:1. Both mutations were restored.

The parity snapshot SHA256 remains `F9F1A45BCD6151A5629C6355EDB249FCFC1D75750F61F1819CAD884317F85DA7`. `git diff --exit-code 6ad878e -- engine/tests/document/parity.snapshot.json engine/tests/compile/golden engine/tests/compile/fixtures` exited 0. All 55 fixture paths are clean in status and therefore byte identical to the T003 baseline. The recorded T003 aggregate was `1f238e21168390f3011b1890d2aedef4ce1aa16783df14e43ca8b7b55ec9eb52`.

The a11y case now explicitly demands each checkbox, one bound label, and nonempty label text. Its focused run passed 62 of 62 tests. The full `npm run verify` passed after lifecycle fix `5191002`: 86 files and 1675 tests against T001's 80 and 1572, six new files and 103 tests. A11y is 62 against 61. Contrast retained 411 storefront elements and seven wizard screens in each palette, and added the page paste panel at 3 sections, 3 checkboxes and 16 measured nodes in each palette. Secret scan is 488 against 457, and dash scan 349 against 332, reflecting the added files. Menu file remained 21.2 KB with 9 headings, 4 tables and 13 embedded pictures. PWA update passed.
