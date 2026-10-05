# Android 6 image picker follow-up

## Reproduction and baseline

On 2026-10-05, the SM_T700 was connected again. It runs Android 6.0.1, API 23,
with WebView 106. The installed version was `0.13.0-test.5`, versionCode 23.
Four pages were visible before updating: Figures, DeviceQA and two Untitled pages.

Full PowerShell `npm run verify` exited 0 on the feature 033 code with the test.6
version bump: 94 test files, 1,968 tests, 65 accessibility tests, clean secret and
dash scans, passing light/dark contrast, menu-file, local-picture and PWA gates.
`npm run android:sync` exited 0. JDK 21 Gradle reported
`BUILD SUCCESSFUL in 2m 10s`. The signed test.6 APK, versionCode 24, passed
v1/v2/v3 verification with the expected certificate and minSdk 23. SHA-256:
`945AE6B1E94606D2BDAB1FD9C864AD61796917D4F2CAAD02E1F8BB1AAB794019`.
The packaged index.html and both JavaScript entry bundles matched app/dist by
SHA-256. `adb install -r` returned `Success`. All four prior pages remained listed.

## Native import result

Android DocumentsUI selected an ADB-copied fictional Markdown file containing
headed CSV. The review suggested Item, Price and Size correctly. Choosing the
nearby heading as the category and saving created a separate Tablet CSV check
page. Preview and Copy retained Blue bowl, 12 oz, from $35, Blue glaze;
Speckled mug, 16 oz, $32, Handmade; and Collection on Saturday. The category
appeared once. This tests CSV inside a text file, not a new CSV picker format.

## Image-picker failure

Adding a Gallery to the new test page and pressing Add a picture from this device
opened Android's generic chooser. Samsung Gallery requested location, contacts
and calendar access. Declining all three returned to the app without a selected
picture. Reopening repeated the prompts. No unrelated permission was granted.

The image selection is delegated by DocumentFileChromeClient to Capacitor's
`FileChooserParams.createIntent()` path. Text and backup files already use
ACTION_OPEN_DOCUMENT and worked on this device. The bounded fix is to include
ordinary image selection in that existing path, retaining camera capture,
no-provider fallback and web-layer byte validation. FR-014 records this follow-up.

## Correction and verification

DocumentFileChromeClient now includes image MIME types in its existing
ACTION_OPEN_DOCUMENT route and uses `image/*` for those requests. Capture and
no-provider fallback remain unchanged. No permissions or dependencies were added.
Independent spec-compliance and code-quality reviews passed without blockers.

A native regression check located the actual picture button through UIAutomator,
tapped it, and asserted the resumed activity was DocumentsUI. Before the change
it failed with GrantPermissionsActivity (exit 1, 4.16 seconds). After the change
it passed with `com.android.documentsui/.DocumentsActivity` (exit 0, 4.06 seconds).
This tests actual routing rather than searching Java source for an intent name.

The final JDK 21 build reported `BUILD SUCCESSFUL in 53s`. Signed
`0.13.0-test.7`, versionCode 25, passed v1/v2/v3 verification with minSdk 23 and
certificate SHA-256
`c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`.
APK SHA-256:
`AE97FA0BFB758ED02F2051578F4BA350B02FE00AEC69D81BB89E75F794E4046B`.
`adb install -r` returned `Success`; installed version metadata matched.

Full PowerShell `npm run verify` exited 0 again after the native correction:
94 files and 1,968 tests, 65 accessibility tests, typecheck, lint, secret and
dash scans, light/dark contrast, menu-file, local-picture and PWA gates passed.
The build retains flatDir and Gradle deprecation warnings. Signature verification
reports unsigned META-INF metadata entries for v1; v1/v2/v3 verification passes.

On the tablet, DocumentsUI opened Images, then Pictures, and selected the
fictional `mdsb-033-picture.png` fixture. The editor showed the thumbnail,
caption `Tablet PNG fixture`, Saved, and "This picture is in your menu file".
Opening replacement selection and cancelling retained it. Preview displayed the
picture alongside both imported products and the collection note.

Export opened Android's Save menu.html share sheet. It was cancelled without
sending anything. The generated file was pulled from the app's external export
directory and inspected: 112,770 bytes, exactly one embedded PNG data URL,
82,583 decoded image bytes, both products, the complete `from $35` price, the
collection note and caption. The decoded image was visually checked. Force-stop
and relaunch retained the saved thumbnail and caption.

The final page drawer showed five pages: the separate Tablet CSV check plus
Figures, DeviceQA and both original Untitled pages with their prior edit dates.
No prior page was removed or edited. USB stay-awake was restored to 0, and no
WebView debugging socket was present. No restart is required.

Evidence images:

- [Imported menu preview](media/2026-10-05-tablet-csv-preview.png)
- [Imported menu Copy view](media/2026-10-05-tablet-csv-copy.png)
- [Picture after cold launch](media/2026-10-05-tablet-picture-persisted.png)
- [Preserved page list](media/2026-10-05-tablet-pages-preserved.png)

## Remaining scope

This native check covers one PNG on Android 6.0.1 / WebView 106. Missing/generic
MIME cases remain covered by desktop tests; camera capture and no-provider
fallback were reviewed but not exercised on the tablet. The five real seller
sessions remain the release gate; a solo device check cannot replace them.
All three stacked PRs remain draft. No normal release was published.
