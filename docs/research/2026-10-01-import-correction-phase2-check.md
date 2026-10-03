# Import correction Phase 2 browser check, 2026-10-01

## Method

I drove the built app in headless Chrome through the same Chrome DevTools Protocol used by the repository's browser gates. Each run used a cleared, isolated browser profile at 320 by 844 or 390 by 844 CSS pixels. The source was fictional:

```markdown
| Amount | Price | Item | Notes |
| --- | --- | --- | --- |
| 12 oz | $28 | Speckled mug | Handmade |
| 16 oz | $32 | Blue mug | Blue glaze |
```

In each viewport, I opened Paste a page, assigned the proposed columns as Prices, opened Adjust imported prices, changed source row 4 to `Blue bowl` and `from $35`, and pressed Add. I then opened the saved Prices section, Preview and Copy. The browser task exited 0 twice. The full `npm run verify` also exited 0 before this run: 90 test files, 1,804 tests, 63 accessibility tests, and passing secret, dash, contrast, menu-file and PWA update gates.

## Observed result

| Check | 320 px | 390 px |
| --- | --- | --- |
| Correction cards visible | 2 | 2 |
| Source row 4 visible beside corrected fields | Yes | Yes |
| Corrected review | Blue bowl, 16 oz, from $35, Notes: Blue glaze | Same |
| Document width overflow | 0 px | 0 px |
| Saved Build fields | Item `Blue bowl`, Price `from $35` | Same |
| Buyer Preview | Blue bowl and from $35 | Same |
| Copy output | Blue bowl and `from &#36;35` | Same |
| Browser runtime exceptions | 0 | 0 |

The Copy output uses the host's HTML entity for the dollar sign; its displayed selling value remains `from $35`. The untouched Speckled mug row remained in the reviewed section.

[320 px source and correction](media/2026-10-01-correction-320-source.png), [320 px lower controls](media/2026-10-01-correction-320.png), [390 px source and correction](media/2026-10-01-correction-390-source.png), [390 px lower controls](media/2026-10-01-correction-390.png).

## Limit

This run dispatched browser input and click events into the real built UI. It did not measure finger interaction or typing latency on the Android 6 tablet. Those checks remain in the whole-feature gate, along with shared-name and category tasks that Phase 3 is implementing now. Seller task sessions remain necessary before claiming that the workflow feels easier.
