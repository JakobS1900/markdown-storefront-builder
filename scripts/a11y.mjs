/**
 * Accessibility gate. Constitution Principle VI: every interactive control must
 * present a 44 by 44 CSS pixel touch target, carry an accessible name, be
 * keyboard operable, and CI must fail on violations.
 *
 * There is no app yet. Roadmap item 2.2 is the first to render an interactive
 * control, and this gate becomes enforcing there.
 *
 * This script exists now, and is wired into `npm run verify`, so the gate is a
 * tracked, visible gap rather than something remembered later. It exits 0 while
 * skipping and says plainly that it is skipping. It must never be made to pass
 * silently.
 */
import { existsSync } from "node:fs";

const APP_ENTRY = "app/index.html";

if (!existsSync(APP_ENTRY)) {
  console.log(
    `a11y gate SKIPPED: no app yet (${APP_ENTRY} not found).\n` +
      "  Principle VI becomes enforcing at roadmap item 2.2, the block editor,\n" +
      "  which is the first code to render an interactive control.",
  );
  process.exit(0);
}

console.error(
  `a11y gate NOT IMPLEMENTED but ${APP_ENTRY} now exists.\n` +
    "  An app is present, so this gate must be implemented before it can pass.\n" +
    "  See constitution Principle VI.",
);
process.exit(1);
