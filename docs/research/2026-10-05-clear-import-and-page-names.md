# Clear import choices and saved-page naming

## Scope and baseline

Feature 035 implements the two remaining approved bounded recommendations from
the October 5 tablet audit. The baseline is signed test.8 on Samsung SM_T700,
Android 6.0.1 with WebView 106. Before changes, the device lists ten saved pages.
The current Ceramics QA page contains Speckled mug ($28, 12 oz) and Azure mug
($36, 16 oz). Its Copy output is preserved in ignored temp/035-copy-before.xml.
The page list is preserved in temp/035-pages-before.xml. Existing user pages
must remain untouched; the current QA page may be renamed to check naming.

## Import choice evidence

Chunk 1 tests failed before product changes: 9 failed, 57 passed. After minimal
wording and accessible-identity changes, 66 focused tests passed. The whole
suite then passed 1,970 tests across 94 files. Fresh spec and quality reviews
passed with no findings. Log and detailed report: temp/035-import-suite.log and
temp/035-import-report.md.

Use actions now lead with the candidate and role; original line is secondary.
Accessible labels add original line and table section. Undo names the choice
and states all linked prices, including choices accumulated across selections.
Tests cover literal quoted/markup-like long names, repeated candidates, selected
counts, focus after use/undo, no-candidate behavior and unchanged review output.

## Naming and combined verification

The actual-shell Chrome probe first failed with `Missing button: Name this page`
before implementation. It uses an isolated temporary profile and Chrome's own
assigned debugging port. The naming integration tests also failed first because
the action was absent, then passed through actual jsdom history traversal.
Spec review caught an unconditional surface change clearing unfinished Build
paste and undo. A new regression failed with the missing draft; the minimal
surface guard made it pass. Final focused result: 62 tests across five files,
including six naming cases. Focused ESLint passed. Fresh spec and quality reviews
passed after the fix. Report: temp/035-title-report.md.

Actual Chrome naming checks passed at 800, 390, 320 and 1400px. From Copy,
the drawer or pinned action opens Build, opens the real title disclosure and
keeps the input focused after typing and repaint. Input height is 47.578125px,
it is in view, and document width equals each requested viewport width.

The long quoted markup-like candidate probe exposed a pre-existing section
checkbox label that did not wrap. The new choice buttons already wrapped.
Added one `overflow-wrap: anywhere` declaration to the section list and extended
the permanent import-layout gate with an unbroken table header. Red reported
994px page width at all three requested widths. Green reported exactly 800,
390 and 320px, preserving its existing keyboard and correction assertions.
The combined browser probe then passed literal text safety, source-choice touch
targets, no overflow and focus after use and undo. Its initial navigation probes
were corrected to focus clicked controls and open the collapsed table review,
matching actual user interaction rather than leaving a typed field focused.
Logs: temp/035-layout-red.log, temp/035-layout-green.log and
temp/035-browser-final.log.

Whole-diff review found a stale Copy/Preview history entry after naming. Six
regression assertions failed before the fix. Naming now consumes the drawer
entry and the surface entry in sequence before focusing the existing field.
The focused navigation suite passed 40 tests across three files, including
eight naming cases. The next Back reaches the pre-app entry in drawer and
pinned layouts; later navigation does not rerun the one-time callbacks.
Final independent review passed. Chrome confirmed root Build history and title
focus at all four widths. Final `npm run verify` exited 0: 1,978 tests across
95 files, 65 accessibility assertions, light/dark contrast, menu export, local
pictures, import layout and PWA update gates all passed. Log:
temp/035-verify-final.log. Native release verification follows below.

## Integration

Existing PRs 1 through 4 were read-only audited: all engineering checks passed,
and remaining seller-session restrictions were superseded by the owner's device
testing instruction. Their descriptions were corrected and they merged normally
into master. After each merge, git diff confirmed that master's tree matched the
already verified feature head. Branches and original history were preserved.
Feature 035 starts from d5f36e9, whose tree matches the prior 3484712 baseline.
The full feature shipped through [PR #5](https://github.com/JakobS1900/markdown-storefront-builder/pull/5). Implementation
commit 0ba5fae passed [clean-checkout CI](https://github.com/JakobS1900/markdown-storefront-builder/actions/runs/37330430392).
Normal merge ac074aa has the same tree as the verified branch.
[Master verification](https://github.com/JakobS1900/markdown-storefront-builder/actions/runs/37331153330) and
[deployment](https://github.com/JakobS1900/markdown-storefront-builder/actions/runs/37331512501) passed.
The [normal v0.13.0 release](https://github.com/JakobS1900/markdown-storefront-builder/releases/tag/v0.13.0) has the signed APK.
GitHub reports the same SHA256 digest as the locally verified and installed file.
All five pull requests are merged; original branches and history are retained.

## Signed release and native checks

`npm run android:sync` and JDK 21 `assembleRelease` exited 0. Gradle completed
in 2m 56s after a slow startup; no retry or daemon restart was needed. The
signed APK verifies under v1, v2 and v3 with the existing certificate digest
`c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`.
Packaged modern JavaScript, legacy JavaScript and CSS match the verified build
byte-for-byte. APK SHA256:
`f2e971e2c83b30e4b95502b3aa602c61cb524497cc17a3f572317f3c79422586`.
Gradle deprecation/flatDir and APK metadata warnings remain nonblocking.

In-place installation succeeded. The tablet reports versionName 0.13.0 and
versionCode 27. Native checks passed on SM_T700, Android 6.0.1, WebView 106:

- From Copy, Your pages then Name this page opens Build and focuses the existing
  Ceramics title. Samsung's full keyboard opens and the field stays in view.
- Renaming the existing QA page to Tablet naming check updates the saved list.
  The compiled Ceramics output is byte-identical, 167 UTF-8 bytes before/after.
  The title survives force-stop and cold launch.
- Naming again from Copy, Back hides the keyboard and the next Back returns to
  the Android launcher. It does not revisit a stale Copy or drawer entry.
- qa-name.md shows Use Arrow Orb as the item name and Use Figures as the
  category, each describing two included prices and retaining original lines.
  Undo restores both blank item names and the original destination, retaining
  12 oz/$25 and 16 oz/$32. Reapplying produces one Figures section.
- Saving creates a new fictional QA page. Preview and Copy contain Arrow Orb
  once with both quantity-price rows. Exact Copy output survives cold launch.
  An initial capture ran before WebView finished rendering; the repeated capture
  after readiness passed, with no product change.
- All ten baseline pages remain, including the renamed Ceramics QA page, plus
  one new Figures QA page: eleven total. No existing page was deleted.
- Original input method com.github.uiautomator/.AdbKeyboard restored and checked.
  USB stay-awake restored and checked as 0. No user restart is required.

Evidence: [native naming and Samsung keyboard](images/035-tablet-naming.png),
[native import choices](images/035-tablet-import-choices.png). Machine-readable
captures and exact assertions are in ignored temp/035-*.xml and
temp/035-native-check.py. These are scripted device checks, not seller research.
