import { colors, fontFamily, semanticStyles } from '@huddle/ui';
import { tvLayout } from '../../ui';



export const styles = semanticStyles({
  screen: {
    flex: 1,
  },

  // The wordmark's row on the carousel and the game frame — every TV screen
  // except the Room, which needs the mark out of the flow so its title can
  // share the band (`roomWordmark`).
  header: {
    paddingHorizontal: 56,
    paddingTop: tvLayout.headerTop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 34,
  },
  // Where the module draws — the whole stage under the header. A game that
  // draws nothing leaves the Soft Minimal canvas showing, which is the honest
  // picture until the TV question screens land.
  gameStage: {
    flex: 1,
    alignSelf: 'stretch',
  },
  runtimeStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 96,
  },
  runtimeStatusText: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 24,
    textAlign: 'center',
  },
  // ————— Room —————
  //
  // The whole screen is one column with pinned gaps rather than flexed space,
  // because everything on it has to fit at a *full* room and 720pt is not
  // generous. Flexing the middle instead would let the grid decide where the
  // room code sits, which is the one thing on the screen somebody is trying to
  // read off a photograph of their own television.
  //
  // The column, summed, is `roomScreenHeight()` in `../features/room` — and it is
  // summed *there* rather than described here so that a test can hold it under
  // the handoff's 64pt TV safe margin. A comment cannot: the first draft of this
  // one claimed 666 against a stack that actually measured 684, which is 28pt
  // inside the margin it was claiming to clear. Every `marginTop` below is one
  // of that function's terms; move one and the test says so.

  // The board sets this as a plain heading rather than the pill Soft Minimal used:
  // Soft Minimal has one accent and it is spent on things you act on.
  // The wordmark's gutter position, out of the column's flow.
  // Hard into the top-left corner as of 2026-08-09, where this sat at `headerTop`
  // (32) from the top and 56 from the left. The shared `headerTop` is deliberately
  // left alone: every other TV screen puts its mark in a header row that wants
  // that band, and only the Room floats the mark out of the flow.
  //
  // **0 is as far as this can go, and it is not the screen's corner.** The stage
  // is the title-safe inner 90% (`tvSafeStageScale`), centred, so its own origin
  // already sits ~5% in — about 71 of these units from the physical edge. Zero
  // reaches the stage's corner and no further. Going beyond means a negative
  // offset that draws the mark outside the title-safe rectangle, into the band a
  // television crops without reporting it; #23 exists because this one does. If
  // that trade is ever wanted it should be a deliberate, recorded decision, not a
  // number nudged down until the simulator looks right — the simulator is exactly
  // the surface that cannot show the cost.
});
