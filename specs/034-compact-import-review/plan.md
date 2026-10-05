# Plan: compact import correction

Branch `034-compact-import-review`, based on `1338afd`. Date: 2026-10-05.
Input: [spec](spec.md), approved compact-layout recommendation.

## Approach

Existing TypeScript DOM components, CSS Grid, Vite, Vitest and Chrome CDP scripts.
Android Capacitor wrapper, Android 6 / WebView 106 target. No new dependencies,
data fields, storage changes or engine changes.

One chunk: group the four existing inputs in a responsive container, in DOM
order Item, Price, Amount, Details. Wide layout has two columns; narrow layout
stacks. Keep warning/actions associated with their row and all state callbacks
unchanged. Keep source, destination, selection and result outside the field grid.

Add a real-browser regression using existing CDP/Vite conventions, a fictional
fixture and isolated storage. Observe failure before product edits. Test actual
bounds, labels, keyboard order, values and phone overflow. Record before/after
heights. Wire the rerunnable check into the verification gate.

## Constitution check

| Principle | Compliance |
| --- | --- |
| I. Pure engine | Engine untouched. |
| II. Hosts as data | Targets and output untouched. |
| III. Test first | Browser regression fails first; golden/parity tests run in verify. |
| IV. Narrow gate | Existing sanitizer retained; no new user fields or HTML injection. |
| V. Saved work | No schema/storage change; update APK in place without reset. |
| VI. Accessibility | Named fields, reading-order DOM, 44px targets and keyboard checks. |
| VII. Fidelity | Preview still compiles the document. |

Pre/post-design: all satisfied. Standing push authorization supersedes the
historic no-push-without-instruction wording. No new cross-boundary contract.

## Files and review

`app/src/ui/page-paste.ts`, `app/src/styles.css`, `scripts/import-layout.mjs`,
`package.json`, test version in `android/app/build.gradle`, and evidence docs.
Fresh implementer, fresh spec reviewer, then fresh quality reviewer over the
whole bounded diff. Parent performs full verify and native tablet checks.
zen tools are unavailable; independent review is the substitute.

## Delivery

Commit/push a stacked PR on 033. Do not merge unrelated stacked work as part of
this layout change. Seller sessions are not a gate. All hooks must pass.
