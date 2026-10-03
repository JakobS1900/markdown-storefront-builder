# Android 6 local Markdown file import, 2026-10-02

## Picker path

The SM_T700 runs Android 6.0.1 with Android System WebView 106 and the signed `0.13.0-test.5` build. The fictional `mdsb-tablet-menu.md` had already been copied to `/sdcard/Download` with ADB. Android DocumentsUI's `Downloads` root said `No items`, but its menu offered `Show SD card`. After choosing that option, `Device storage > Download` listed both the `.md` and `.txt` fixtures. This identifies the prior empty list as a difference between the picker's virtual Downloads root and its physical storage browser. [The physical Download folder](media/2026-10-02-android6-file-import-picker.png) shows the selectable `.md` file.

An attempt to open the public fictional fixture URL in the tablet browser through ADB was rejected by automatic command review with `blocked by policy`; no further reason was given. The test continued through the picker's storage root. The file selected here was ADB copied, so this does not verify a browser-managed download entry.

## End-to-end result

Selecting the `.md` returned to the app and filled the source field. [Import review](media/2026-10-02-android6-file-import-review.png) showed `# Figures`, `Arrow Orb`, and the three-column table. I chose the table's Item, Amount, and Price columns, then explicitly used the nearby `Arrow Orb` line as the two rows' item name and `Figures` as their category. The correction panel showed both included rows before saving: `12 oz / $25` and `16 oz / $32`.

The app's `Add 1 section as a new page` action saved a separate page. [Preview](media/2026-10-02-android6-file-import-preview.png) shows one Figures category, one Arrow Orb item, and both amount and price pairs. [Copy](media/2026-10-02-android6-file-import-copy.png) retains the same values in Markdown output. After a force stop and cold launch, `Figures, 1 item` remained on Build. [The page drawer](media/2026-10-02-android6-file-import-pages.png) lists Figures and all three earlier pages. No earlier page was deleted or replaced.

The tablet was awake immediately before each screenshot. USB stay-awake was restored afterward; `dumpsys power` reported `mStayOn=false` and `mStayOnWhilePluggedInSetting=0`. This establishes a real local `.md` selection, WebView file read, correction, save, Preview, Copy, and persistence on API 23 with WebView 106. It does not establish support for WebView 49. Five real seller task sessions still need to test whether people can discover and complete this workflow without guidance.
