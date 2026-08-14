# Visual source manifest

The former Phone and TV redesign boards were removed as part of the UI/UX
clean-slate reset. They are not current product inputs, runtime assets, or
acceptance evidence. Git history is the only archive.

The active visual source of truth is
[`../../soft-minimal-handoff.md`](../../soft-minimal-handoff.md), which defines
the white/black centered `PurposeScreen` baseline, the illustrated Phone Join
Room exception, and the illustrated TV Room Invitation exception.

The supplied TV lobby source set lives under
`apps/tv/assets/room-invitation`. `tv-lobby-background.png` and
`tv-lobby-phone-icon.png` are runtime inputs. `tv-lobby-empty.png` is the exact
1672×941 baked reference composite used for visual comparison only; Metro must
never import it. Architecture validation enforces that exclusion and validates
all three supplied files by dimensions and SHA-256 digest.
