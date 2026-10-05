# Scripted tablet workflow verification

On 2026-10-05 Jakob said testers are unavailable and instructed us to use the
tablet. This replaces the five-participant gate. These are direct device checks,
not participant observations, timing comparisons or evidence of discoverability.

Device: Samsung SM_T700, Android 6.0.1, WebView 106. Installed signed build:
`0.13.0-test.7`, versionCode 25, application code `d02278d`. The application was
operated through ADB touch/key input, UIAutomator and screenshots. No saved state
was injected. Fictional import fixtures were selected through DocumentsUI.

## Results

| Workflow | Observed result |
| --- | --- |
| Create a menu | Created Ceramics with Hand-thrown mug at $28, Speckled planter at from $35, Custom name plaque at Ask me, then Prints with Botanical print at $18. Preview and Copy preserved order, category names and exact prices. |
| Correct an imported table | Selected Item, Price and Size using the existing suggested assignments. Used Ceramics as the category. Changed Blue mug to Blue bowl and $32 to from $35 before Add. Preview and Copy retained its 16 oz and Blue glaze, plus unchanged Speckled mug, $28, 12 oz and Handmade. |
| Protect edits during mapping | Selected No size column after correcting the row. The Keep row edits, Discard row edits and Cancel mapping change choices appeared. Cancel retained the original size mapping and corrected name/price in the saved result. Keep and Discard were not exercised in this pass. |
| Correct a short price list | Imported three lines, changed only Hand-dyed scarf to Hand-dyed silk scarf at from $40 before Add. Preview and Copy retained Woven basket at $24 and Cotton tote at $18. |
| Reuse a nearby item name | Reviewed the Item/Amount/Price table, applied Arrow Orb as the name for both offers and Figures as category. Add created one section. Preview and Copy contained Figures and Arrow Orb once each, then 12 oz at $25 and 16 oz at $32. |
| Persistence and preservation | Force-stop/relaunch retained the final quantity menu. The drawer showed nine pages: the five present before this pass and four newly created test pages. Original edit dates remained unchanged. USB stay-awake was restored to 0. |

The final Copy output was:

```markdown
### Figures

#### Arrow Orb

| Quantity | Price |
| --- | --- |
| 12 oz | &#36;25 |
| 16 oz | &#36;32 |
```

Dollar entities in Copy render as the expected currency symbol in Preview.
Native picture selection, embedded HTML export and picture persistence were
verified earlier in the [native picker pass](2026-10-05-native-picture-picker.md).

## Evidence and testing observations

- [Menu created from scratch](media/2026-10-05-workflow-create.png)
- [Corrected imported table](media/2026-10-05-workflow-correction.png)
- [Quantity menu without duplicated source text](media/2026-10-05-workflow-quantity.png)

Local raw UI dumps are in ignored `temp/qa-task*-preview.xml`,
`temp/qa-task*-copy.xml`, `temp/qa-task2-mapping-warning.xml`,
`temp/qa-task4-cold.xml` and `temp/qa-pages-final.xml`.

UIAutomator omitted the native select popup even when it was open. Window state
and a fresh awake screenshot confirmed the popup; selecting its visible option
worked. Initial shell input also expanded a dollar sign, which was corrected
through properly quoted input and verified before judging the app. Neither was
an application defect. The expanded bottom section chooser was closed to reach
Add category. These test interactions are not seller usability observations.

No application defect was established and no application code changed. The test
pages are retained. No downgrade, uninstall, storage reset, public posting or
external message was performed. No device restart is required.

The old seller-session requirement is superseded, not falsely marked completed.
Normal integration, verification, signing and release checks still apply.
