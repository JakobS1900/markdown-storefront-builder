# Review contract

- Detection never changes source text. Mapping decodes cells only for editable values.
- Ambiguous structure remains Text with existing correction tools available.
- A table's recognized header/rule lines are ignored as furniture consistently by output and coverage, including repeated headers.
- Every other source line remains accounted for exactly once and in order unless the seller explicitly moves, consumes or excludes it.
- A failed picture add returns `{ ok: false, message }`; no document reference is assigned before success.
- No saved contract crosses the engine/app boundary differently, so a new Document parity contract is unnecessary. Existing parity tests remain required.
