# Huddle approved screen references

The images in this directory are the sole visual source of truth for the Huddle platform. Earlier generated screen directions are not active references.

The screen-by-screen raster and native asset readiness review is recorded in [`ASSET-AUDIT.md`](./ASSET-AUDIT.md).

## Implementation overrides

- The TV lobby must arrange player avatars across two rows.
- The TV game picker must show exactly three cards at once: one selected card centered, larger, and visually forward, with one neighboring card on each side.
- These overrides take priority over any reference frame that shows one avatar row or five game cards.

## Reference set

- `heartbeat-direction.png`: brand, palette, typography, avatars, components, and overall visual language.
- `approved-screens/phone-platform-lifecycle.png`: loading, lobby, scanner recovery, paused, seat-loss, and finished states.
- `approved-screens/phone-manual-join-flow.png`: manual room-code flow.
- `approved-screens/phone-player-identity-flow.png`: avatar and name selection flow.
- `approved-screens/phone-qr-scan-recovery-flow.png`: scan introduction, permission, active scanning, validation, malformed-code, camera-unavailable, and unavailable-room states.
- `approved-screens/phone-host-player-management.png`: transfer Host, remove player, away-player, and leave confirmations.
- `approved-screens/phone-game-picker-carousel-list.png`: primary game-picker carousel and list layouts.
- `approved-screens/phone-game-picker-sync-leave.png`: primary synchronization, error, guest-waiting, and leave-picker states.
- `approved-screens/phone-trivia-voting-setup.png`: Trivia and Voting setup flows.
- `approved-screens/phone-trivia-gameplay-flow.png`: Trivia intro, private answering, locked/waiting, reveal handoff, next question, and finished Host/player states.
- `approved-screens/phone-voting-gameplay-flow.png`: Voting intro, private voting, locked/waiting, reveal handoff, next round, and finished Host/player states.
- `approved-screens/tv-lobby-game-picker-flow.png`: TV room and game-selection states, subject to the overrides above.
- `approved-screens/tv-platform-system-states.png`: TV loading, recovery, pause, game-entry, unavailable, and finished states.
- `approved-screens/tv-trivia-gameplay-flow.png`: Trivia intro, question, participation, reveal, standings, next question, final podium, and lobby return.
- `approved-screens/tv-voting-gameplay-flow.png`: Voting intro, prompt, participation, reveal, live-tally, voter-label, recap, and lobby-return states.
- `approved-screens/platform-motion-storyboard.png`: splash, loading, transition, roster, carousel, game-world, success, and reduced-motion direction.

Exact, near-duplicate, and superseded generated boards were intentionally stored once. The recovered versions were selected for state correctness as well as visual quality; rejected TV-background experiments and old game-picker variants are not part of this reference set.
