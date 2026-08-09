import { borderWidth, codeLetterBox, colors, fontFamily, letterSpacing, minBodyFontSize, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';
import { ROOM_QR_SIZE, roomLayout, seat, SEAT_HEIGHT, SEATS_PER_ROW } from './roster';

const QR_CARD_PADDING_X = 14;
const QR_CARD_PADDING_Y = 11;
const QR_CARD_WIDTH = ROOM_QR_SIZE + QR_CARD_PADDING_X * 2;
const CODE_QR_GAP = 27;
const CODE_ROW_OFFSET = CODE_QR_GAP + QR_CARD_WIDTH;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // The wordmark's row on the carousel and the game frame — every TV screen
  // except the Room, which needs the mark out of the flow so its title can
  // share the band (`roomWordmark`).
  roomWordmark: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // 48/58 as of 2026-08-09, up from 40/48. The board's own title ink
  // measures 356 × 45 in design units against this screen's 334 × 42, so 40 was
  // already a little under it, and a television is read from across a room where
  // a board is read at desk distance. `roomLayout.titleLine` grew with it: at
  // 48px the descenders in "your phone" need more than a 48pt box.
  roomTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 48,
    lineHeight: roomLayout.titleLine,
    marginTop: roomLayout.titleTop,
    textAlign: 'center',
  },
  // The code column and the QR beside it.
  //
  // The tiles are centred on the stage, with the title above them and the caption
  // below on the same centre, and the QR sits off to their right without dragging
  // them — `CODE_ROW_OFFSET` carries that arithmetic and the reasoning.
  //
  // This is a deliberate departure from the board, decided 2026-08-09. The board's
  // own hero is asymmetric: its tiles centre on 605 of 1280 while its title
  // centres on 640, so reproducing it leaves the code out of line with its own
  // heading. Aligning the three won instead. Do not add an offset here to chase
  // the board's placement.
  //
  // The 27pt gap and the tiles' own 26pt spacing *are* the board's, measured off
  // `01-room.png` in design units (board pixels ÷ 1.30625). They read 43 and 23
  // until 2026-08-09, from the board export that #27 replaced; the geometry moved
  // and the tokens were never re-measured against the second export.
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: CODE_QR_GAP,
    marginTop: roomLayout.heroGap,
    marginLeft: CODE_ROW_OFFSET,
  },
  codeGroup: {
    alignItems: 'center',
    gap: roomLayout.tileCaptionGap,
  },
  // 474pt of tiles across: four at `tileWidth` with the board's 26pt between.
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: roomLayout.dividerGap,
    // The board's rule runs 165–1107 of 1280.
    paddingHorizontal: 168,
  },
  dividerRule: {
    flex: 1,
    height: borderWidth.hairline,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
    letterSpacing: letterSpacing.label,
    lineHeight: roomLayout.dividerLine,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    justifyContent: 'center',
    columnGap: seat.columnGap,
    rowGap: seat.rowGap,
    marginTop: roomLayout.gridGap,
    // Exactly `SEATS_PER_ROW` seats wide, so the wrap happens where the design
    // says it does rather than wherever the stage runs out — a grid that broke
    // on available width would silently become 6×2 the first time a measurement
    // moved, and the room caps at ten.
    width: SEATS_PER_ROW * seat.width + (SEATS_PER_ROW - 1) * seat.columnGap,
  },
  seat: {
    width: seat.width,
    height: SEAT_HEIGHT,
    alignItems: 'center',
  },
  seatAvatar: {
    width: seat.avatar,
    height: seat.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  // A place nobody has taken: the board's dashed circle with its number in it.
  //
  // Both are a step darker than the board draws them, and than `colors.border`
  // — which is what a divider is for and measures 1.19:1 against this canvas.
  // These circles are not a divider: "there is room for you" is the whole
  // message of an empty room, read from a sofa, and a ring nobody can see does
  // not carry it. `colors.away` takes the ring to 2.37:1 and `mutedText` takes
  // the number past the 3:1 the repo already holds large text to.
  seatAvatarEmpty: {
    borderColor: colors.away,
    borderWidth: borderWidth.hairline,
    borderStyle: 'dashed',
  },
  seatNumber: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 24,
  },
  avatarWrap: {
    width: seat.avatar,
    height: seat.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostCrown: {
    position: 'absolute',
    top: -26,
    zIndex: 1,
  },
  seatName: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 20,
    lineHeight: seat.nameLine,
    marginTop: seat.nameGap,
    // A long nickname is truncated rather than wrapped: the seat is one line
    // tall by construction, and a name on two lines would push its own status
    // slot out of the row it shares with four others.
    maxWidth: seat.width,
  },
  seatChip: {
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    marginTop: seat.statusGap,
  },
  seatChipJustJoined: {
    backgroundColor: colors.justJoined,
  },
  seatChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.tv,
    // Half the label tracking the HOST slot wears. `JUST JOINED!` is twelve
    // characters in a column sized for a nickname, and full tracking spends
    // 22pt of it on air — enough to wrap the chip onto a second line and take
    // its seat out of the row with it.
    letterSpacing: letterSpacing.label / 2,
    lineHeight: seat.statusLine,
    // The tracking is applied *between* letters and after the last one too, so
    // a centred all-caps chip reads a point or two left of centre without this.
    marginRight: -letterSpacing.label / 2,
  },
  seatChipTextJustJoined: {
    color: colors.inverse,
  },
  seatHost: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.tv,
    letterSpacing: letterSpacing.label,
    lineHeight: seat.statusLine,
    marginTop: seat.statusGap,
  },
  seatChipAway: {
    backgroundColor: colors.awayChipSurface,
  },
  seatChipTextAway: {
    color: colors.awayChipText,
  },
  seatDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.online,
    borderRadius: radius.pill,
    marginTop: seat.statusGap + (seat.statusLine - 12) / 2,
  },
  countLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: roomLayout.countLine,
    marginTop: roomLayout.countGap,
  },
  // Deep navy rather than muted grey as of 2026-08-09, the same call as the
  // caption above the roster: this line carries the room's state — how full it is
  // and whether the Host can start — and a television is read from the sofa,
  // where grey-on-warm is the first thing to go. The count itself stays in the
  // accent (`countJoined`), so the number still leads the line.
  countText: {
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: 22,
    lineHeight: roomLayout.countLine,
  },
  countJoined: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
  },
  tiles: {
    flexDirection: 'row',
    gap: 26,
  },
  // The approved board uses a warm square tile (`roomLayout.tileWidth/Height`,
  // measured off the board at 99×99); the letter stays large enough to read
  // across the room without changing the line box.
  tile: {
    width: roomLayout.tileWidth,
    height: roomLayout.tileHeight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.roomSurface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    // `chip` (10) rather than `card` (20). Measured off the board: at a tile's
    // top row the white span is inset by exactly the corner radius, which puts
    // the board's at 12 board pixels — 9.2 in these units. `card` was double it,
    // and at this size a doubled radius reads as a different shape rather than a
    // softer one.
    borderRadius: radius.chip,
  },
  tileLetter: {
    // The letter fills its tile and is centred in it, rather than sizing itself
    // to its own glyph — which is what keeps an I from vanishing on tvOS. See
    // `codeLetterBox`; it carries the whole story.
    ...codeLetterBox,
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 52,
    // Inter's line box is taller than its caps; pinning it keeps the letter
    // optically centred in the tile instead of riding low.
    lineHeight: 58,
  },
  // The board draws this line in the same deep navy as everything else on the
  // screen and leans on weight, not colour, for the product name. It was
  // `colors.roomCaption` grey until 2026-08-09 — the clearest colour delta in the
  // whole comparison, and the wrong end of it: this is the line that tells the
  // room what to do with the code above it.
  caption: {
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: 22,
    lineHeight: roomLayout.captionLine,
  },
  captionEmphasis: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
  },
  // The caption's slot, on the soft peach accent surface, when the news is that
  // nothing is working.
  troubleChip: {
    // Exactly the caption's line, so the stack below it does not move when the
    // news turns bad — `roomScreenHeight` has one answer, not two.
    height: roomLayout.captionLine,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.soft,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  troubleChipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    // The caption's own size: this is the one line on the screen that has to be
    // read and acted on.
    fontSize: 22,
  },
  // The QR uses its own bitmap inside a warm Room card. The padding is split
  // because the board's card is wider than it is tall — 152 × 145 board pixels,
  // so 116 × 111 here around an 89pt bitmap.
  qrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: QR_CARD_PADDING_X,
    paddingVertical: QR_CARD_PADDING_Y,
    backgroundColor: colors.roomSurface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    // The board's QR card corner measures 11 board pixels — 8.4 here — so it
    // takes the same `chip` as the tiles beside it rather than `card`.
    borderRadius: radius.chip,
  },
  qr: {
    width: ROOM_QR_SIZE,
    height: ROOM_QR_SIZE,
  },
});
