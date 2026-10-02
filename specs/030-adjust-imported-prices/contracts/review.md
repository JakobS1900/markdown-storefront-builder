# Review contract: Source to saved page

This is an internal app contract. It does not change the exported `Document` JSON schema.

1. Every editable reviewed row names its original source line. Paging, remapping and category moves do not change that association.
2. Review shows the exact name, amount, price, details, inclusion and destination that Add will use. The review count comes from the same pure output builder as confirmation.
3. A mapping applies only to its source table. Every nonempty source line is covered once as a reviewed item, confirmed table furniture or heading, or retained Text. Unassigned nonempty cells remain in public details or retained Text. A failed mapping keeps source as Text with an actionable message. A retained Text span splits Prices blocks so output keeps source order. A moved offer stays at its source position under its destination heading, which may repeat after intervening content.
4. Corrections and category assignments stay in the import draft. `Add` freezes one reviewed result, validates a new document, then writes. A failed validation or write leaves the previous saved page and the draft intact.
5. A source change that would discard edits requires a deliberate choice. Cancelling that choice retains the same text and corrections. A new paste session never receives a late file read from an older session.
6. Buyer output never receives a private supplier cost guessed from public source. Price text is not parsed, rounded, converted or recalculated after the seller confirms it.
7. Unsupported syntax stays readable as Text until the seller explicitly turns source lines into reviewed items. Header and separator lines are not products. Empty sections have a visible recovery action.
8. The draft is bound to the starting page ID and target. Switching pages pauses Add and retains the draft. Confirmation refuses a different current page and never silently uses a different target.
9. After corrections exist, Edit source uses a separate buffer. Cancel does not change draft text, mappings or corrections. File input follows the same replacement choice. Manual Text-to-Prices correction is a separate explicit action and never bypasses the guarded automatic swap.
10. Confirmation checks the page binding before writing. Competing page switches are held or rejected until the validated page has been written and adopted by that confirmation.
