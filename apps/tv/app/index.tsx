import { api } from '@huddle/convex';
import {
  gamePlayersFrom,
  type GameModule,
  ROOM_CODE_LENGTH,
  roomJoinLink,
} from '@huddle/game-core';
import { type CarouselWindow, carouselWindow, runningGameScreen } from '@huddle/game-registry';
import {
  borderWidth,
  codeLetterBox,
  codeLetterColor,
  codeTileTilt,
  colors,
  fontFamily,
  letterSpacing,
  minBodyFontSize,
  motionDuration,
  opacity,
  popIn,
  radius,
  shadowDepth,
  springOf,
  stickerTilt,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { cardEntryOffset } from '../src/card-transition';
import { arrivalToGreet, carouselFooterLine } from '../src/carousel-footer';
import { type Arrivals, JUST_JOINED_MS, noteArrivals } from '../src/just-joined';
import { closeExpiredRoom, deployed, openRoom } from '../src/room';
import {
  keepOpeningRoom,
  type OpenRoom,
  type RoomOpening,
  roomOpeningAtLaunch,
  type RoomOpeningCaption,
  roomOpeningCaption,
} from '../src/room-opening';
import { footerSeatCount, type RosterSeat, rosterFooterText, seat } from '../src/roster';
import { TvStage } from '../src/tv-stage';

/** The QR's edge, per the handoff ("~196px QR"). */
const QR_SIZE = 196;

/**
 * A TV footer's line box at 22px, pinned rather than left to React Native's
 * default. The pairing footer centres its count against the seats with it, and
 * the carousel's footer *is* it — which makes that footer's height, and so how
 * far the page dots clear the focused card's shadow, a measured number rather
 * than an inferred one.
 */
const FOOTER_TEXT_LINE = 28;

/**
 * The TV — Pairing screen (docs/design/design-handoff.md §1): the Room Code in
 * four tiles, the QR that deep-links a phone straight into the room, and the
 * roster filling up underneath.
 */
export default function TvPairingScreen() {
  const { opening, reopen } = useRoomOpening();
  const room = opening.kind === 'open' ? opening.room : undefined;

  // The screen's live subscriptions only exist once there is a room to
  // subscribe to — and a room can only be open on a launch that has a Convex
  // client for `ConvexProvider` to provide. Until then the pairing screen draws
  // its empty seats from nothing.
  if (room === undefined) {
    return (
      <PairingStage opening={opening} code={undefined} footer={<RosterFooter roster={[]} />} />
    );
  }

  // Keyed by the room, so a room that expires takes its seats and everything
  // this screen watched happen in it away with it: the replacement starts as
  // empty as a pairing screen on a fresh launch.
  return <OpenRoomStage key={room.roomId} room={room} opening={opening} onExpired={reopen} />;
}

/**
 * A television with a room open on it: the pairing screen, or the game the room
 * is playing.
 *
 * The room's subscriptions live here rather than in either screen below,
 * because they must outlive the switch between them. Expiry is the one that
 * matters: a room that ends while a game is on screen still has to send this
 * television back to a fresh Room Code, and a `stillOpen` subscription mounted
 * inside the lobby would stop watching the moment the game started.
 */
function OpenRoomStage({
  room,
  opening,
  onExpired,
}: {
  readonly room: OpenRoom;
  readonly opening: RoomOpening;
  readonly onExpired: (expired: OpenRoom) => void;
}) {
  const roster = useRoster(room);
  const arrivals = useArrivals(roster);
  const { greeted, noteGreeted } = useGreeted();
  useRoomExpiry(room, onExpired);

  // What the room says it is playing. Its own subscription: this changes twice
  // a game, where the roster changes on every join, claim and heartbeat.
  const running = useQuery(api.games.running, { roomId: room.roomId });
  const screen = runningGameScreen(running);
  // Which card the Host is on. Its own subscription, and the one the AC times:
  // the room writes it on a tap and Convex pushes it here.
  const browsingAt = useQuery(api.games.browsing, { roomId: room.roomId });

  if (screen.kind === 'unknownGame') {
    return <UnknownGameStage gameId={screen.gameId} />;
  }

  if (screen.kind === 'game') {
    return <GameStage module={screen.module} state={screen.state} roster={roster ?? []} />;
  }

  // A room nobody has joined is still inviting people in, so it keeps the big
  // code and the QR. The moment there is a player there is a Host, and the
  // television becomes what that Host is browsing — the code stays reachable in
  // the header chip, which is where the handoff's lobby and carousel both keep
  // it (§3, §6).
  const seats = roster ?? [];
  const browsing = carouselWindow(browsingAt ?? 0);

  if (seats.length > 0 && browsing !== undefined) {
    return (
      <CarouselStage
        window={browsing}
        code={room.code}
        roster={seats}
        arrivals={arrivals}
        // Which greetings this television has already spent. It is held here,
        // beside the subscriptions, for the same reason they are: it has to
        // outlive the switch to a game and back, which is precisely the trip
        // that would otherwise announce the room's last arrival all over again.
        greeted={greeted}
        onGreeted={noteGreeted}
      />
    );
  }

  return (
    <PairingStage
      opening={opening}
      code={room.code}
      footer={<RosterFooter roster={seats} />}
    />
  );
}

/**
 * The Room Code, the QR and the roster: the television between games
 * (docs/design/design-handoff.md §1 and §3).
 */
function PairingStage({
  opening,
  code,
  footer,
}: {
  readonly opening: RoomOpening;
  readonly code: string | undefined;
  readonly footer: ReactNode;
}) {
  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            HUDDLE<Text style={styles.logoPeriod}>.</Text>
          </Text>
        </View>

        <View style={styles.center}>
          <View style={styles.codeGroup}>
            <StickerSurface
              depth={shadowDepth.phoneCard}
              style={styles.badge}
              wrapperStyle={styles.badgeTilt}
            >
              <Text style={styles.badgeText}>GRAB YOUR PHONE!</Text>
            </StickerSurface>
            <RoomCodeTiles code={code} />
            <PairingCaption caption={roomOpeningCaption(opening)} />
          </View>

          <RoomQrCard code={code} />
        </View>

        {footer}
      </View>
    </TvStage>
  );
}

/**
 * TV — Game carousel (docs/design/design-handoff.md §6): the game the Host is
 * browsing, with its neighbours either side, and the room's code still on the
 * header so somebody arriving late can still get in.
 *
 * The television is a renderer here as everywhere else — it draws the index the
 * room stored, and the Host's phone is the only thing that moves it. Nothing on
 * this screen knows which game it is showing: the card is `GameMetadata`, which
 * is what metadata is for.
 */
function CarouselStage({
  window,
  code,
  roster,
  arrivals,
  greeted,
  onGreeted,
}: {
  readonly window: CarouselWindow;
  readonly code: string;
  readonly roster: readonly RosterSeat[];
  readonly arrivals: Arrivals | undefined;
  readonly greeted: ReadonlySet<RosterSeat['playerId']>;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
}) {
  const host = roster.find((seat) => seat.host);
  const arrival = arrivalToGreet(arrivals, roster, greeted);

  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.carouselHeader}>
          <Text style={styles.logo}>
            HUDDLE<Text style={styles.logoPeriod}>.</Text>
          </Text>
          <View style={styles.roomChipGroup}>
            <Text style={styles.roomChipLabel}>room</Text>
            <StickerSurface depth={shadowDepth.tvCard} style={styles.roomChip}>
              <Text style={styles.roomChipText}>{code}</Text>
            </StickerSurface>
          </View>
        </View>

        <CarouselCards window={window} />

        <View style={styles.carouselFooter}>
          <View style={styles.pageDots}>
            {Array.from({ length: window.total }, (_unused, position) => (
              <View
                key={position}
                style={[styles.pageDot, position === window.index && styles.pageDotActive]}
              />
            ))}
          </View>
          <BrowsingLine
            // Keyed by the player being greeted, so every phone that lands
            // starts its own four seconds — the same mount that starts a
            // seat's, on the one screen that has no seats.
            key={arrival?.playerId ?? 'nobody'}
            host={host}
            arrival={arrival}
            onGreeted={onGreeted}
          />
        </View>
      </View>
    </TvStage>
  );
}

/**
 * The three cards, and the Card Transition between them (the handoff's
 * "TV animates card transition ~250ms ease-out").
 *
 * The row slides in from the direction the room browsed: the cards themselves
 * are swapped by the render that follows Convex's push, so what travels is the
 * row arriving where the new focused card belongs, not each card moving to its
 * own new place. `cardEntryOffset` decides the sign;
 * `motionDuration.cardTransition` and the ease-out are the handoff's.
 *
 * A slide and nothing else — no fade, no scale. The handoff pins the duration
 * and the easing and leaves the rest, and a translation is the one thing on this
 * screen that cannot cost a measurement: it is not laid out, so no card, dot or
 * shadow moves anywhere Yoga can see it, and the footer's 10pt of daylight under
 * the focused card's shadow is exactly where the last task left it.
 */
function CarouselCards({ window }: { readonly window: CarouselWindow }) {
  const entry = useCardTransition(window.index);

  return (
    <Animated.View style={[styles.carousel, entry]}>
      {/* The side cards are absent rather than duplicated with one game
          installed — `carouselWindow` is what decides that, and this just
          draws what it was handed. */}
      <SideKeyArt game={window.previous} />
      <FocusedGameCard game={window.focused} />
      <SideKeyArt game={window.next} />
    </Animated.View>
  );
}

/**
 * §6's footer line — "<Host> is browsing on their phone" — and the four seconds
 * of it that belong to a phone that has just landed.
 *
 * The greeting is here rather than on a seat because this screen has no seats:
 * the television leaves the pairing roster behind at the first join, so every
 * player after the first arrives to a television that says nothing. It borrows
 * the browsing line's own slot, in punch pink, which is what keeps the footer at
 * the height the page dots' daylight was measured against (`carouselFooter`).
 *
 * The four seconds are counted here, as a seat counts its own: the room does not
 * record when a phone landed, and a live query reports what happens rather than
 * four seconds of nothing happening. Where this differs from a seat is that the
 * *answer* is remembered above, in `useGreeted` — a seat is drawn continuously
 * and can be trusted to count once, while this line is torn down for the length
 * of a game and put back afterwards, and a greeting that restarted on the way
 * back would announce a phone that landed before the game did.
 */
function BrowsingLine({
  host,
  arrival,
  onGreeted,
}: {
  readonly host: RosterSeat | undefined;
  readonly arrival: RosterSeat | undefined;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
}) {
  // One clock, not two. The greeting lasts exactly as long as this screen has
  // an ungreeted arrival to draw: the timer below reports the four seconds
  // spent, that answer goes into `greeted` above, and `arrivalToGreet` stops
  // naming them — which is what takes the sentence back to §6's own line. A
  // second timer here to fade the punch would be a second opinion about when
  // four seconds are up.
  const line = carouselFooterLine(host, arrival);

  // Spending a greeting is what makes it spent, and the room is told so that
  // the knowledge outlives this screen. The cleanup reports it too, not only
  // the timer: a game starting partway through the four seconds unmounts this
  // line, and a television that comes back from ten minutes of trivia to
  // announce an arrival it was already announcing is worse than one that cut a
  // greeting short. Marking the same player twice is deliberately harmless.
  useEffect(() => {
    if (arrival === undefined) {
      return undefined;
    }

    const { playerId } = arrival;
    const timer = setTimeout(() => onGreeted(playerId), JUST_JOINED_MS);

    return () => {
      clearTimeout(timer);
      onGreeted(playerId);
    };
  }, [arrival, onGreeted]);

  // The handoff's avatar pop-in, on the surface that inherited what it was
  // announcing. See `usePopIn`.
  const pop = usePopIn(line.greeting);

  return (
    <Animated.Text style={[styles.browsingLine, line.greeting && styles.arrivalLine, pop]}>
      {line.text}
    </Animated.Text>
  );
}

/**
 * The focused card: key art over the title and its chips (handoff §6 — 440×520,
 * 4px ink border, 10px cobalt offset shadow).
 */
function FocusedGameCard({ game }: { readonly game: GameModule }) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = game.metadata;

  return (
    <StickerSurface
      depth={shadowDepth.tvHero}
      shadowColor={colors.cobalt}
      style={styles.focusedCard}
    >
      <View style={[styles.keyArt, { backgroundColor: colors[keyArt.color] }]}>
        <Text style={styles.keyArtTitle}>{title}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.chips}>
          <Chip text={`${playerRange.min}–${playerRange.max} players`} />
          <Chip text={`~${estimatedMinutes} min`} />
          <Chip text={category} tone={colors.yellow} />
        </View>
      </View>
    </StickerSurface>
  );
}

/** A neighbouring card: key art alone, dimmed, tilted and stood back (§6). */
function SideKeyArt({ game }: { readonly game: GameModule | undefined }) {
  if (game === undefined) {
    // Nothing rather than a placeholder: an empty slot beside the focused card
    // would read as a game that failed to draw.
    return null;
  }

  return (
    <View style={styles.sideCardWrapper}>
      <View style={[styles.sideCard, { backgroundColor: colors[game.metadata.keyArt.color] }]}>
        <Text style={styles.sideCardTitle}>{game.metadata.title}</Text>
      </View>
    </View>
  );
}

/** One meta chip under a card's title. */
function Chip({ text, tone }: { readonly text: string; readonly tone?: string }) {
  return (
    <View style={[styles.chip, tone === undefined ? null : { backgroundColor: tone }]}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/**
 * The television with a game on it: the module's own screen, under a header
 * that says only what `GameMetadata` already told the hub.
 *
 * Nothing here knows which game it is drawing — the header is metadata and the
 * stage below it is the module's.
 */
function GameStage({
  module,
  state,
  roster,
}: {
  readonly module: GameModule;
  readonly state: unknown;
  readonly roster: readonly RosterSeat[];
}) {
  // Mounted as a component rather than called as a function, so a game's screen
  // owns its own hooks instead of registering them on this one's list.
  const TvScreen = module.screens.tv;

  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            HUDDLE<Text style={styles.logoPeriod}>.</Text>
          </Text>
          <Text style={styles.gameTitle}>{module.metadata.title}</Text>
        </View>

        <View style={styles.gameStage}>
          <TvScreen state={state} players={gamePlayersFrom(roster)} />
        </View>
      </View>
    </TvStage>
  );
}

/**
 * The room is playing a game this television does not have — an un-updated TV
 * in a room whose phones have moved on. Said out loud rather than drawn as a
 * pairing screen, which would put a Room Code up for a room that is mid-game.
 */
function UnknownGameStage({ gameId }: { readonly gameId: string }) {
  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            HUDDLE<Text style={styles.logoPeriod}>.</Text>
          </Text>
        </View>

        <View style={styles.center}>
          <StickerSurface depth={shadowDepth.phoneCard} style={styles.badge}>
            <Text style={styles.badgeText}>UPDATE HUDDLE</Text>
          </StickerSurface>
          <Text style={styles.unknownGameText}>
            This room is playing {gameId}, which this TV doesn’t have yet.
          </Text>
        </View>
      </View>
    </TvStage>
  );
}

/**
 * One tile per letter, in Boardwalk's per-position color and tilt. The tiles
 * are drawn before the code arrives so the screen does not reflow around it —
 * on a local backend the room opens well inside a couple of frames.
 *
 * Drawing them empty first is what used to blank an I on tvOS. The Code Letter
 * Box fix keeps that no-reflow decision safe: the letter takes its box from the
 * tile, so nothing here depends on measuring a glyph and the full alphabet can
 * be minted again.
 */
function RoomCodeTiles({ code }: { readonly code: string | undefined }) {
  return (
    <View style={styles.tiles}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_unused, position) => (
        <StickerSurface
          key={position}
          depth={shadowDepth.tvCard}
          style={styles.tile}
          // The tilt goes on the wrapper: rotating the tile alone would swing
          // it off its own shadow.
          wrapperStyle={{ transform: [{ rotate: codeTileTilt(position) }] }}
        >
          <Text style={[styles.tileLetter, { color: codeLetterColor(position) }]}>
            {code?.charAt(position) ?? ''}
          </Text>
        </StickerSurface>
      ))}
    </View>
  );
}

/**
 * The line under the tiles: the invitation to join, or — when there is no code
 * to join with — what has gone wrong, as a Boardwalk status chip.
 *
 * Trouble is promoted from the caption's quiet muted line to a bordered yellow
 * pill because of who is reading it and when: four blank code tiles are the
 * least explicable thing this app can put on a television, and the sentence
 * explaining them competes with a hero the size of the screen. The chip is
 * assembled from parts the system already has — the handoff's chip accent, its
 * pill radius, a TV card's 4px ink border and 6px offset shadow, a sticker tilt
 * that leans against the badge above it — because the handoff draws no failure
 * state for this screen at all (it draws a TV that is working).
 */
function PairingCaption({ caption }: { readonly caption: RoomOpeningCaption }) {
  if (!caption.trouble) {
    return <Text style={styles.caption}>{caption.text}</Text>;
  }

  return (
    <StickerSurface
      depth={shadowDepth.tvCard}
      style={styles.troubleChip}
      wrapperStyle={styles.troubleChipTilt}
    >
      <Text style={styles.troubleChipText}>{caption.text}</Text>
    </StickerSurface>
  );
}

/** The Join Link as a QR: scanning it opens the Controller straight into the room. */
function RoomQrCard({ code }: { readonly code: string | undefined }) {
  return (
    <StickerSurface
      depth={shadowDepth.tvCard}
      style={styles.qrCard}
      wrapperStyle={styles.qrCardTilt}
    >
      <View style={styles.qr}>
        {code === undefined ? null : (
          <QRCode
            value={roomJoinLink(code)}
            size={QR_SIZE}
            color={colors.ink}
            backgroundColor={colors.surface}
          />
        )}
      </View>
      <Text style={styles.qrCaption}>or scan to join</Text>
    </StickerSurface>
  );
}

/**
 * The roster under the code: the handoff's dashed circles, and the count of who
 * is in the room.
 *
 * Every seat it draws is empty, and that is the screen rather than a case it
 * handles: the carousel replaces this footer the moment anybody joins
 * (`CarouselStage` above, which a build with a game installed always reaches at
 * `seats.length > 0`), so a seat with a player in it cannot be drawn on a
 * television. The circles say "there is room for you", which is the whole job.
 *
 * It is still handed the roster and still counts off it rather than printing the
 * empty room's line as a constant: the count is §1's own copy, tested at nought,
 * one and ten (`rosterFooterText`), and a footer that had forgotten how to count
 * would have to be taught again by whoever decides this screen should outlive
 * the first join.
 *
 * The seat treatments that needed a player — the claimed-color circle, the
 * initials, the nickname, the status dot, the arrival's punch shadow, the Host's
 * tangerine one and the away dimming — were deleted rather than left drawing for
 * nobody ("Delete the TV's unreachable seat code" in docs/implementation-plan.md).
 * What the television says instead is §6's footer line, and what it no longer
 * says about an away player is the Host Roster's job on the Host's own phone.
 */
function RosterFooter({ roster }: { readonly roster: readonly RosterSeat[] }) {
  return (
    <View style={styles.footer}>
      <View style={styles.seats}>
        {Array.from({ length: footerSeatCount(roster.length) }, (_unused, position) => (
          <EmptySeat key={position} />
        ))}
      </View>
      <Text style={styles.footerText}>{rosterFooterText(roster.length)}</Text>
    </View>
  );
}

/** A seat nobody has taken: the handoff's dashed circle. */
function EmptySeat() {
  return (
    <View style={styles.seat}>
      <View style={[styles.avatar, styles.avatarEmpty]} />
    </View>
  );
}

/**
 * How the room this TV shows is getting on: opening, reconnecting, open, or
 * never going to open because this build has no deployment — and `reopen`, for
 * when the room that was open has expired and the screen needs another.
 *
 * `keepOpeningRoom` owns the retrying, and `openRoom` is memoised outside React
 * — so this effect re-running (StrictMode, Fast Refresh, a remount) rejoins the
 * attempt already in flight or reads the room already opened, rather than
 * minting another one. `reopen` is the one thing that clears that memo, which is
 * why it is also what starts the effect over: from here on the launch is exactly
 * as it was at the beginning, minus a room that no longer exists.
 */
function useRoomOpening(): {
  readonly opening: RoomOpening;
  readonly reopen: (expired: OpenRoom) => void;
} {
  /** How many rooms this screen has watched end — the trigger, not a statistic. */
  const [roomsEnded, setRoomsEnded] = useState(0);
  const [opening, setOpening] = useState<RoomOpening>(() => roomOpeningAtLaunch(deployed));

  useEffect(
    () => (deployed ? keepOpeningRoom(openRoom, setOpening) : undefined),
    // `deployed` is fixed at bundle time, so the only thing that ever opens a
    // second room is the first one expiring.
    [roomsEnded],
  );

  const reopen = useCallback((expired: OpenRoom) => {
    closeExpiredRoom(expired);
    setOpening(roomOpeningAtLaunch(deployed));
    setRoomsEnded((ended) => ended + 1);
  }, []);

  return { opening, reopen };
}

/**
 * Watches the room this TV is showing for the end of it.
 *
 * A room whose party has gone is deleted ten minutes later, and nobody is going
 * to touch the television about it — so the news has to arrive as a push, which
 * is what this subscription is. Until it does, the screen is showing a Room Code
 * that belongs to no room: the worst thing a pairing screen can display, because
 * it fails silently in the hands of whoever types it.
 *
 * It cannot be read off the roster, which is the subscription this screen
 * already holds: an expired room and a room nobody has joined are the same empty
 * roster, and they want opposite treatment.
 */
function useRoomExpiry(room: OpenRoom, onExpired: (expired: OpenRoom) => void): void {
  const stillOpen = useQuery(api.rooms.stillOpen, { roomId: room.roomId });

  useEffect(() => {
    // `undefined` is the moment before the first answer, which says nothing.
    if (stillOpen === false) {
      onExpired(room);
    }
  }, [stillOpen, room, onExpired]);
}

/**
 * Who is in the room, live. `useQuery` holds a subscription open for as long as
 * the screen is mounted, so a join reaches the TV as a push from Convex rather
 * than on a poll the TV would have to be awake for — the roster redraws within
 * a round trip of the phone's tap.
 *
 * The moment before the first answer lands is the `undefined` this hands on
 * rather than flattening to an empty room: a screen that has not been told who
 * is here is not a screen that has been told nobody is, and `useArrivals` is
 * the part of this one that has to tell the difference.
 */
function useRoster(room: OpenRoom): readonly RosterSeat[] | undefined {
  return useQuery(api.players.roster, { roomId: room.roomId });
}

/**
 * Who this screen has watched arrive, kept up with the roster.
 *
 * Folded during render rather than in an effect, because it is derived from the
 * roster and nothing else: the first snapshot to land is the baseline, and every
 * one after it is compared with what was already on the screen. `noteArrivals`
 * hands back the identical value whenever a snapshot seats nobody — which is
 * most of them, since claiming a color and going away both push a fresh roster —
 * so this settles on the render after a join and holds still through everything
 * else.
 */
function useArrivals(roster: readonly RosterSeat[] | undefined): Arrivals | undefined {
  const [arrivals, setArrivals] = useState<Arrivals>();
  const noted = roster === undefined ? arrivals : noteArrivals(arrivals, roster);

  if (noted !== arrivals) {
    setArrivals(noted);
  }

  return noted;
}

/**
 * Which arrivals this television has already spent its four seconds on.
 *
 * Being an Arrival is permanent — a player stays one for as long as they stay
 * seated — but a greeting is not, and nothing in a live query ever reports the
 * four seconds ending. So the screen remembers, and this is the memory: it lives
 * above the switch between the carousel and a game, which is the one trip that
 * would otherwise re-announce a phone that landed before the game started.
 *
 * The same player being noted twice is expected rather than guarded against: the
 * greeting is marked spent both when it runs out and when a game cuts it short,
 * and those are the same fact. The set is returned unchanged when it already
 * holds the player, because the component doing the noting re-renders on it.
 */
function useGreeted(): {
  readonly greeted: ReadonlySet<RosterSeat['playerId']>;
  readonly noteGreeted: (playerId: RosterSeat['playerId']) => void;
} {
  const [greeted, setGreeted] = useState<ReadonlySet<RosterSeat['playerId']>>(() => new Set());

  const noteGreeted = useCallback((playerId: RosterSeat['playerId']) => {
    setGreeted((already) =>
      already.has(playerId) ? already : new Set(already).add(playerId),
    );
  }, []);

  return { greeted, noteGreeted };
}

/**
 * The Card Transition: the carousel row sliding into place behind an index the
 * room has just moved (handoff — "TV animates card transition ~250ms ease-out").
 *
 * Which index this screen was drawing is state rather than a ref, and it is
 * folded during render the way `useArrivals` folds the roster: the animation is
 * derived from the index changing, and an effect that compared indices would be
 * a second opinion about what the render already knows. `cardEntryOffset` turns
 * the pair into the direction the strip travels, and a zero offset — a mount, a
 * roster push, a re-render for any of the other reasons this screen has — is no
 * animation at all rather than a 250ms animation of nothing.
 *
 * `useLayoutEffect` because the reset and the frame it is reset for must be the
 * same frame. The driver is left settled between transitions, so an ordinary
 * effect would commit one frame of the new cards already in place and only then
 * throw them back out to their starting offset — a backwards jump at the head of
 * every transition, which is precisely the stutter this is meant to remove.
 */
function useCardTransition(
  index: number,
): { readonly transform: readonly [{ translateX: Animated.Value }] } {
  const [slide] = useState(() => new Animated.Value(0));
  const [entry, setEntry] = useState(() => ({ index, offset: 0 }));

  if (entry.index !== index) {
    setEntry({ index, offset: cardEntryOffset(entry.index, index) });
  }

  useLayoutEffect(() => {
    if (entry.offset === 0) {
      return undefined;
    }

    slide.setValue(entry.offset);

    // Ease-out as the handoff writes it, at the duration Boardwalk holds for
    // this animation: fast off the mark and settling into the new card, which
    // is the shape of a carousel that has been *pushed* somewhere rather than
    // one drifting there. Cubic is CSS's own `ease-out` curve.
    const travel = Animated.timing(slide, {
      toValue: 0,
      duration: motionDuration.cardTransition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    travel.start();

    // A Host holding the arrow moves the index again mid-slide; the next
    // transition resets the driver from wherever this one had reached, and a
    // stopped animation is what keeps the two from fighting over it.
    return () => travel.stop();
  }, [entry, slide]);

  return { transform: [{ translateX: slide }] };
}

/**
 * The handoff's avatar pop-in — "scale 0.6→1 with slight overshoot, ~300ms
 * spring" — on the one surface still drawing what it was written for.
 *
 * The handoff hangs it on the §3 lobby card of the player who just joined, and
 * §3 is never coming; the pairing Seat that stood in for that card is drawn only
 * for an *empty* room, so a spring there would have run for nobody — which is
 * why that seat now draws nothing but a circle. What survived the
 * loss is the greeting itself: the Carousel Footer Line hands its four seconds
 * to the newest Arrival, in punch, on the screen the whole party is looking at.
 * That is what pops in — the same event, the same treatment, the same ~300ms,
 * one surface further along. Written up against the handoff's Motion section
 * and against this task in docs/implementation-plan.md.
 *
 * `Animated.spring` takes physics rather than a duration, so the token is
 * converted (`springOf`) instead of being handed over: a spring's period is the
 * honest reading of "~300ms spring", and the damping ratio is what makes the
 * overshoot slight.
 *
 * Nothing pops when the line is saying who is browsing. That sentence is not
 * news, and a footer that sprang every time a room's Host changed their mind
 * would be motion for its own sake — the opposite of Eyes up.
 */
function usePopIn(greeting: boolean): { readonly transform: readonly [{ scale: Animated.Value }] } {
  const [scale] = useState(() => new Animated.Value(greeting ? popIn.fromScale : 1));

  useEffect(() => {
    if (!greeting) {
      return undefined;
    }

    // Reset before springing, so the hook does not quietly depend on how it is
    // mounted. The caller keys this line by the player being greeted, which
    // makes every greeting a fresh instance whose scale starts at 0.6 — but a
    // `key` that reads as redundant is a `key` somebody removes, and without
    // this line that edit would leave `scale` sitting at 1, spring 1→1, and
    // delete the pop-in with every test still green.
    scale.setValue(popIn.fromScale);

    const spring = Animated.spring(scale, {
      toValue: 1,
      ...springOf(motionDuration.popIn, popIn.dampingRatio),
      useNativeDriver: true,
    });

    spring.start();

    return () => spring.stop();
  }, [greeting, scale]);

  return { transform: [{ scale }] };
}

// Every measurement below is the handoff's own, at its 1280×720 design size;
// `TvStage` scales the lot to the television.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },

  header: {
    paddingHorizontal: 56,
    paddingTop: 36,
  },
  logo: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 34,
  },
  logoPeriod: {
    color: colors.tangerine,
  },

  // Bungee at the header's right end, opposite the wordmark: the game's name,
  // which is the one thing the hub can say about a game it does not know.
  // Header as the handoff's lobby: logo left, "room" + code chip right.
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 28,
  },
  roomChipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomChipLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
  },
  roomChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.chip,
  },
  roomChipText: {
    color: colors.cobalt,
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    letterSpacing: letterSpacing.roomCode,
    marginRight: -letterSpacing.roomCode,
  },

  carousel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  // 440×520 with the ink border and the cobalt offset shadow (§6).
  focusedCard: {
    width: 440,
    height: 520,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.cardLarge,
  },
  keyArt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  keyArtTitle: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontSize: 46,
    lineHeight: 52,
    textAlign: 'center',
  },
  cardInfo: {
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 22,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 38,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.chip,
  },
  chipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
  },

  // 300×400 at half opacity and stood back, per §6. The tilt comes from
  // Boardwalk's own sticker rotation rather than a number invented here.
  sideCardWrapper: {
    opacity: opacity.carouselSideCard,
    transform: [{ scale: 0.94 }, { rotate: stickerTilt.carouselSideCard }],
  },
  sideCard: {
    width: 300,
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.cardLarge,
  },
  sideCardTitle: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },

  // The dots and the line side by side rather than stacked. §6 asks for "page
  // dots + '<Host> is browsing on their phone'" and does not say in which
  // direction, and one row is 28pt of content instead of 56: the footer goes
  // 92 → 64, the card lands at 124→644 with its 10px cobalt shadow to 654, and
  // the dots sit at 664. Ten points of daylight under the shadow the active dot
  // used to disappear into, with every pinned §6 number left alone — the
  // arithmetic and the two nudges that did not work are in the plan.
  //
  // `justifyContent` is load-bearing rather than decorative: `screen` stretches
  // this footer across the full 1280pt, so a row without it packs the dots and
  // the line against the left edge. `alignItems` stays and changes meaning —
  // it now centres the two on each other's line.
  carouselFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 36,
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.mutedBorder,
    borderRadius: radius.pill,
  },
  // The active dot is a cobalt pill with an ink border (§6).
  pageDotActive: {
    width: 32,
    backgroundColor: colors.cobalt,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
  },
  browsingLine: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 22,
    lineHeight: FOOTER_TEXT_LINE,
  },
  // An arrival's four seconds: Boardwalk's "join/new highlight" pink, and
  // nothing else. Same family, same size, same pinned line — the greeting is
  // the footer's own sentence changing colour, and a line box that could not
  // move is a footer that cannot grow back into the card's shadow.
  arrivalLine: {
    color: colors.punch,
  },

  gameTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 34,
  },
  // Where the module draws — the whole stage under the header. A game that
  // draws nothing leaves the Boardwalk canvas showing, which is the honest
  // picture until the TV question screens land.
  gameStage: {
    flex: 1,
    alignSelf: 'stretch',
  },
  unknownGameText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 96,
  },

  codeGroup: {
    alignItems: 'center',
    gap: 28,
  },
  badge: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    backgroundColor: colors.tangerine,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
  },
  badgeTilt: {
    transform: [{ rotate: stickerTilt.badge }],
  },
  badgeText: {
    color: colors.surface,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    letterSpacing: letterSpacing.badge,
  },
  tiles: {
    flexDirection: 'row',
    gap: 18,
  },
  tile: {
    width: 148,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.card,
  },
  tileLetter: {
    // The letter fills its tile and is centred in it, rather than sizing itself
    // to its own glyph — which is what keeps an I from vanishing on tvOS. See
    // `codeLetterBox`; it carries the whole story.
    ...codeLetterBox,
    fontFamily: fontFamily.semibold,
    fontSize: 88,
    // Bungee's line box is taller than its caps; pinning it keeps the letter
    // optically centred in the tile instead of riding low.
    lineHeight: 96,
  },
  caption: {
    color: colors.mutedText,
    fontFamily: fontFamily.regular,
    fontSize: 22,
  },
  // The caption's slot, in Boardwalk's chip accent, when the news is that
  // nothing is working: a TV card's border and shadow because it is on a TV,
  // and the pill radius every Boardwalk label wears.
  troubleChip: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
  },
  troubleChipTilt: {
    transform: [{ rotate: stickerTilt.statusChip }],
  },
  troubleChipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    // The caption's own size, which is well past the 18px a TV allows: this is
    // the one line on the screen that has to be read and acted on.
    fontSize: 22,
  },

  qrCard: {
    alignItems: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.card,
  },
  qrCardTilt: {
    transform: [{ rotate: stickerTilt.qrCard }],
  },
  qr: {
    width: QR_SIZE,
    height: QR_SIZE,
  },
  qrCaption: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 20,
  },

  footer: {
    flexDirection: 'row',
    // Top-aligned, and the count is dropped onto the circles' centre line
    // below: centring the row instead would hang the count off the middle of a
    // seat *and its reserved name line*, half a name lower than the handoff
    // draws it.
    alignItems: 'flex-start',
    gap: 24,
    paddingBottom: 36,
    paddingHorizontal: 56,
  },
  seats: {
    flexDirection: 'row',
    gap: seat.gap,
  },
  seat: {
    width: seat.size,
    // The circle keeps the box the handoff draws it in, reserved name line and
    // all, though no seat can carry a nickname any more (see `RosterFooter`).
    // That line is 30pt of the footer's height, and the footer's height is where
    // this row of circles sits: giving it back to the centre group would move
    // the code tiles and the seats off the frame the fidelity pass measured
    // them on (`tools/design-fidelity/01-tv-pairing.png`), which is a screen
    // change and not a deletion.
    height: seat.size + seat.nameGap + seat.nameLine,
    alignItems: 'center',
  },
  avatar: {
    width: seat.size,
    height: seat.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: borderWidth.medium,
  },
  avatarEmpty: {
    borderColor: colors.mutedBorder,
    borderStyle: 'dashed',
  },
  footerText: {
    color: colors.mutedText,
    fontFamily: fontFamily.regular,
    fontSize: 22,
    lineHeight: FOOTER_TEXT_LINE,
    // Onto the centre line of the avatar circles beside it, where the handoff
    // has it, rather than the centre of the taller seat that holds them.
    marginTop: (seat.size - FOOTER_TEXT_LINE) / 2,
  },
});
