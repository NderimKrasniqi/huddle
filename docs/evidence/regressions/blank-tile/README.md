# The blank Room Code tile, before and after

The evidence for Phase 5's "A Room Code tile sometimes draws empty on tvOS",
kept here so it can be read without a tvOS simulator. Four crops, one rectangle:
the same pixels of the pairing screen's tile row in every frame, since the fix
does not move the row.

| file | what it shows |
|---|---|
| `before-900-01.png` | `R _ J _` — the code arrived 900ms after the tiles mounted |
| `before-60-01.png` | `R _ J _` — same, 60ms |
| `after-900-01.png` | `R I J I` |
| `after-60-01.png` | `R I J I` |

Produced by `../blank-tile-watch.py N --keep LABEL` on the repro in
`../blank-tile-repro.patch` (a pinned `RIJI` delivered after mount), either side
of spreading `codeLetterBox` into the tile letter's style. Eight launches a side:
8/8 blank before, 0/8 after. The per-tile ink-coverage numbers, and what the
letters have to do with React Native's placeholder for empty text, are in the
task in `docs/implementation-plan.md`.

Each timing's crop is byte-identical to the other's — the same two images twice —
which is the repro being deterministic rather than an oversight.
