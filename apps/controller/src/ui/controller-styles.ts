import { borderWidth, codeLetterBox, colors, fontFamily, letterSpacing, minBodyFontSize, opacity, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';

const PRESS_TRAVEL = 2;
const AVATAR_TILE = 64;
const AVATAR_GAP = 12;
const AVATAR_COLUMNS = 4;

export const controllerStyles = StyleSheet.create({
  heading: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 28,
    // Inter's line box runs taller than its caps; pinning it keeps the
    // heading's own spacing rather than the font's.
    lineHeight: 34,
    textAlign: 'center',
  },

  field: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },
  // A measurement the handoff gives and this screen does not take, twice over.
  // Soft Minimal wrote this label at 13 against a floor of 14; Soft Minimal writes
  // it at 13 against a floor of 12. Either way the answer is the token and not
  // a number: a floor a single spec line can undercut is not a floor, and a
  // bare literal here would read as a measurement rather than as the rule being
  // obeyed. It moves when `minBodyFontSize` does, which is the point.
  label: {
    alignSelf: 'flex-start',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
  },

  tiles: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    width: 64,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    // Every state carries the same border width, so a cell filling in never
    // nudges the letter beside it.
    borderWidth: borderWidth.hairline,
    // Proportional to the TV tile's 24px on 148px, so the phone's smaller tile
    // reads as the same object (handoff: 10–16px on small elements).
    borderRadius: radius.chip,
  },
  tileActive: {
    borderColor: colors.ink,
  },
  tileEmpty: {
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  tileLetter: {
    // As on the TV's tiles, and for the same reason there: a Room Code letter
    // takes its box from its cell, never from its own glyph. These cells cannot
    // blank the way the TV's did — an empty one renders a caret or nothing at
    // all, never an empty `<Text>`, so they never file the measurement that
    // poisons an I — but the rule is the rule, and one of them keeping it by
    // accident is not worth the difference.
    ...codeLetterBox,
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 36,
    // As on the TV's tiles: the line box is taller than the caps unless it is
    // pinned to the cap height.
    lineHeight: 40,
  },
  caret: {
    width: 3,
    height: 36,
    backgroundColor: colors.accent,
  },
  caretHidden: {
    opacity: 0,
  },
  // Invisible, and over the whole row: a tap anywhere on the tiles raises the
  // keyboard, and what is typed lands in the one field that holds the code.
  codeInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },

  // A Surface wrapper sits between a full-width surface and its parent,
  // so the stretch has to be asked for on the wrapper as well as the surface —
  // otherwise the wrapper shrink-wraps and the card stops filling the column.
  stretch: {
    alignSelf: 'stretch',
  },

  nameField: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.input,
  },
  nameInput: {
    // 50 inside the wrapper's two 3px borders is the handoff's 56px field.
    minHeight: 50,
    paddingHorizontal: 18,
    // Android gives a TextInput its own vertical padding; the wrapper owns the
    // height here, so the field is centred in it rather than pushed off centre.
    paddingVertical: 0,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 18,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    // The gap a button with an icon needs, and nothing on one without: an empty
    // flex gap costs a button with a single label nothing.
    gap: 10,
    minHeight: 56,
    backgroundColor: colors.accent,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.button,
  },
  buttonUnavailable: {
    opacity: opacity.unavailable,
  },
  // Soft Minimal's press: the button travels into its own shadow. The shadow is a
  // rectangle sitting still behind it, so moving the face is the whole effect —
  // what shows past the edge shortens by exactly as far as the button went, and
  // no second shadow value has to be kept in step with this one.
  buttonPressed: {
    transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
  },
  buttonLabel: {
    color: colors.surface,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
  },
  failure: {
    alignSelf: 'stretch',
    color: colors.accent,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
  },

  // The seat-loss notice under the heading. Ink rather than punch: a removed or
  // closed-out player is being told what happened, not warned off a mistake, so
  // it reads as the form's own line and not as the red a rejection wears.
  notice: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },

  seatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  // The pill and the code chip travel together at the header's right end, so
  // the row stays a logo and a status group however many badges land in it.
  seatedHeaderEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  codeChipText: {
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    letterSpacing: letterSpacing.roomCode,
    // The room-code chip's letter spacing trails the last letter too; pulling
    // it back keeps the text optically centred in the chip.
    marginRight: -letterSpacing.roomCode,
  },

  // The join form's avatar grid: four across, which is what makes ten read as
  // two full rows and a pair rather than an arbitrary heap. Capped at exactly
  // four tiles and three gaps and centred, so the column count is arithmetic
  // rather than whatever the phone's width happens to allow — see AVATAR_TILE.
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: AVATAR_GAP,
    maxWidth: AVATAR_COLUMNS * AVATAR_TILE + (AVATAR_COLUMNS - 1) * AVATAR_GAP,
  },
  // The chosen one: the accent, and a border rather than a tint, because the
  // artwork already fills the tile.
  avatarChosen: {
    borderColor: colors.accent,
    borderWidth: borderWidth.focus,
  },
  // The tick on the chosen tile's shoulder, half off the corner so it reads as
  // a mark applied to the tile rather than a badge drawn inside it.
  avatarTick: {
    position: 'absolute',
    top: -6,
    right: -6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    backgroundColor: colors.accent,
    borderColor: colors.canvas,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },

  // The Host's roster. No gap: the rows are one list and the rule between them
  // is what says so, which only works if they are actually touching.
  roster: {
    alignSelf: 'stretch',
  },
  // The board's row: no surface, no border, no shadow — a face, a name and the
  // slot, on the canvas. Ten of these is a list; ten bordered cards on ten
  // shadows was ten objects.
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingVertical: 12,
  },
  // The hairline between two rows, drawn as the lower row's top edge so it can
  // never be orphaned under the last one.
  rosterRowRuled: {
    borderTopColor: colors.border,
    borderTopWidth: borderWidth.hairline,
  },
  // "(You)" on the Host's own row, muted so the name still reads as the name.
  rosterYou: {
    color: colors.mutedText,
  },
  // Soft Minimal's treatment for something present but not available, which is
  // exactly what an away player is. The circle only: see `rosterNameAway`.
  rosterAway: {
    opacity: opacity.unavailable,
  },
  rosterName: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  // The nickname mutes rather than dimming with the circle — ink at 30% stops
  // being text, which is the away-badge task's own measurement.
  rosterNameAway: {
    color: colors.mutedText,
  },

  // The manage sheet (task 3.7): a centred confirm dialog over a dimmed room.
  // Centred rather than a bottom sheet so it clears the home indicator without
  // this screen reaching for the safe area the Modal renders outside of.
  sheetRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Soft Minimal's scrim: ink pulled back to a wash, so the room reads as still
  // there behind the dialog. A separate view from the panel, which is its
  // sibling and so keeps its full-strength surface.
  sheetScrim: {
    backgroundColor: colors.ink,
    opacity: opacity.scrim,
  },
  sheetWrapper: {
    alignSelf: 'stretch',
  },
  sheet: {
    alignSelf: 'stretch',
    gap: 14,
    padding: 20,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetName: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 20,
  },
  // The end-room sheet's own title: `sheetName` is a row item beside an avatar
  // and stretches to fill it, which is not what a heading on its own line does.
  sheetTitle: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
  },
  // What ending the room costs, said before it is done. Body text, so it is read
  // at the phone floor rather than at the heading's size.
  sheetBody: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.phone,
    lineHeight: 20,
  },
  sheetCancel: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sheetCancelLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  // Soft Minimal's aside on a phone screen: something true about the room rather
  // than something to press — §5's count line, §7's swipe hint, §8's caption.
  // One entry rather than three near-copies, each of whose comment claimed to
  // be a copy of one of the others.
  aside: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  // §7's hint and §8's caption sit under centred content; §5's count line sits
  // under a list of left-aligned rows and stays with them.
  asideCentred: {
    textAlign: 'center',
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  // The board's round buttons. 56 rather than the handoff's 76: they used to
  // hold a 30pt glyph typed in the body face and now hold a 26pt drawing, and
  // 76 around that is a button mostly made of nothing.
  roundButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  // Where in the list the card is, between the arrows. The board draws it at
  // the weight of a heading rather than as an aside — it is the one thing on
  // the screen that says the picker has more than one thing in it.
  pickedPosition: {
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 26,
  },
  // The settings group sits between the picker and the start button, and is
  // left-aligned rather than centred like the picker above it: the chips wrap
  // onto as many rows as the game's options need, and a wrapped row that
  // centres itself reads as a different list from the one above it.
  settings: {
    alignSelf: 'stretch',
    gap: 14,
  },
  setting: {
    alignSelf: 'stretch',
    gap: 8,
  },
  settingLabel: {
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  settingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingOption: {
    justifyContent: 'center',
    // A comfortable thumb target on the smallest phone Huddle draws on.
    minHeight: 44,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    // Thin, as Soft Minimal borders a chip — these sit inside the picker's own
    // 3px surfaces and would out-weigh them at the same width.
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  settingOptionChosen: {
    backgroundColor: colors.accent,
  },
  settingOptionLabel: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  settingOptionLabelChosen: {
    color: colors.surface,
    fontFamily: fontFamily.semibold,
  },

  // Soft Minimal's "this ends something" surface, and the only punch button on a
  // phone screen — it is meant to be found, not stumbled into.
  backToLobbyButton: {
    backgroundColor: colors.accent,
  },
  waitingFor: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  // Where the module draws. It claims the room left on the screen so a game can
  // fill it, and stays out of the way of a game that draws nothing yet.
  gameStage: {
    alignSelf: 'stretch',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.online,
    borderRadius: radius.pill,
  },

  // ————— The Host's room —————

  // "Your room" and the code, on one line with the title's baseline. The code
  // is the thing a latecomer is being read off somebody's screen, so it keeps
  // the far end rather than sitting under the title where the roster starts.
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  roomCode: {
    alignItems: 'center',
    gap: 4,
  },
  roomCodeLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
  },
  roomCodeLetters: {
    flexDirection: 'row',
    gap: 4,
  },
  // One boxed letter each, as the board draws it and as the television does:
  // a Room Code is read out loud a letter at a time, and four separated boxes
  // is what stops "HUDD" being read as a word.
  roomCodeLetter: {
    minWidth: 24,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  roomCodeLetterText: {
    ...codeLetterBox,
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 22,
  },

  // The count line under the roster, with the dot the board puts on it.
  countLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },

  // The header's outlined pill — Leave on the room and the waiting screen, the
  // way back on the picker.
  outlinePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderColor: colors.accent,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  outlinePillText: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },

  // ————— The roster's right-hand slots —————

  // The Host: the word and the crown, in the accent. Not a filled pill — the
  // accent is the system's one colour and a solid one here would out-shout the
  // primary button at the foot of the same screen.
  hostSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostSlotText: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
  },
  // The system's one informational blue, and the only chip in the product with
  // a border of its own colour: it is news, and it is gone in four seconds, so
  // it has to be findable in a column of dots without being alarming.
  justJoinedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderColor: colors.justJoined,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  // At the floor rather than under it. The board draws this chip smaller than
  // every other word on the screen, and the smallest the phone is allowed to
  // draw body text is 12 — so the floor wins and the chip is a point wider than
  // the board. Written as the token for the reason the field label is: a bare
  // 12 would read as a measurement rather than as a rule being obeyed.
  justJoinedText: {
    color: colors.justJoined,
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
  },
  awaySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  awayText: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },

  // ————— The picker —————

  pickingLabel: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
    textAlign: 'center',
  },
  // The board's tall card. `aspectRatio` rather than a height, so it is the
  // same shape on a small phone and a large one instead of the same number of
  // points on both.
  gameCard: {
    aspectRatio: 1,
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderRadius: radius.card,
  },
  gameCardTitle: {
    color: colors.inverse,
    fontFamily: fontFamily.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  gameCardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  // On the art rather than beside it, so its fill is the inverse at a wash — a
  // solid white chip here punches a hole in the card. The wash is a view of its
  // own beneath the contents rather than an `opacity` on the chip, which would
  // fade the icon and the word along with the fill and leave neither legible
  // against the art they are on.
  gameCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  gameCardChipWash: {
    backgroundColor: colors.inverse,
    borderRadius: radius.chip,
    opacity: opacity.chipOnArt,
  },
  gameCardChipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },

  // ————— Waiting —————

  // The green-washed chip the board draws under the hero. It is not the lobby's
  // status card: there is no border and no shadow, because nothing on this
  // screen is a surface the reader can act on.
  nowViewing: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.soft,
    borderRadius: radius.row,
  },
  // What this phone is about to become, said out loud because the screen is
  // otherwise an absence of controls.
  explainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.row,
  },
  explainerText: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },

  // ————— The manage sheet's target —————

  sheetState: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  // The clock on the away face's shoulder.
  sheetAwayBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    padding: 5,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },

  // ————— Button faces —————

  // A control that cannot be pressed: the board's soft fill and muted ink,
  // rather than the 30% dim, which is the treatment for something present but
  // unavailable and reads on a button as "orange, but faint".
  buttonInert: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  buttonLabelInert: {
    color: colors.mutedText,
  },
  // The second action on a surface that already has a primary one.
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  buttonLabelSecondary: {
    color: colors.ink,
  },
  statusText: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },
});
