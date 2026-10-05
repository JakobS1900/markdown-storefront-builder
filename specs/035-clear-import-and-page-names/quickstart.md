# Verification

Run focused source-choice and sidebar tests with red/green evidence per chunk.
Run npm run verify after reviews. Check actual browser widths 320, 390 and 800,
including long candidate wrapping and drawer title focus from Preview/Copy.
Build signed v0.13.0 with process-local JDK21, verify release certificate and web
asset parity, install with adb install -r on connected SM_T700. Never clear data.
Record saved-page count before/after, import use/undo and naming persistence,
compiled output preservation and native keyboard focus. Restore IME/stay-awake.
