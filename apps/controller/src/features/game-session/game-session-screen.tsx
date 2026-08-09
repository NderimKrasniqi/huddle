import { api } from '@huddle/convex';
import { gamePlayersFrom, type GameEvent, type GameModule, type GamePlayer } from '@huddle/game-core';
import { colors, elevation } from '@huddle/ui';
import { Icon, Surface, Wordmark } from '@huddle/ui/native';
import { useMutation } from 'convex/react';
import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { RosterSeat } from '../room';
import { phoneSessionTokenStore, type PlayerSession } from '../../platform/session';
import { PhoneScreen, SeatedHeader, controllerStyles as styles } from '../../ui';
import { backToLobbyLabel } from './game-controls';
import { lifecycleFailureMessage } from './game-rejection';

export function GameRuntimeStatusScreen({ status, youAreHost, leaveControl }: {
  readonly status: 'paused' | 'unavailable';
  readonly youAreHost: boolean;
  readonly leaveControl: ReactNode;
}) {
  const paused = status === 'paused';
  return (
    <PhoneScreen>
      <SeatedHeader trailing={leaveControl} />
      <Text style={styles.title}>{paused ? 'TV disconnected' : 'Game unavailable'}</Text>
      <Text style={[styles.waitingFor, styles.asideCentred]}>
        {paused
          ? 'The game is paused while Huddle reconnects to the TV.'
          : 'Huddle could not safely read this game. Return to the lobby to continue.'}
      </Text>
      {youAreHost ? <BackToLobbyControl /> : null}
    </PhoneScreen>
  );
}

export function InGameScreen({
  code,
  module,
  state,
  roster,
  playerId,
  youAreHost,
}: {
  readonly code: string;
  readonly module: GameModule;
  readonly state: unknown;
  readonly roster: readonly RosterSeat[];
  readonly playerId: PlayerSession['playerId'];
  readonly youAreHost: boolean;
}) {
  const players = gamePlayersFrom(roster);
  const player = players.find((seated) => seated.playerId === playerId);

  return (
    <PhoneScreen>
      <View style={styles.seatedHeader}>
        <Wordmark height={16} />
        <View style={styles.seatedHeaderEnd}>
          {/* The Host's mark mid-game is the crown alone. The word belongs to
              the roster, where it labels a row among rows; here there is one
              player on the screen and the glyph is the whole of the news. */}
          {youAreHost ? (
            <Icon name="crown" size={18} color={colors.accent} label="You are the host" />
          ) : null}
          <Surface elevation={elevation.phoneSmall} style={styles.codeChip}>
            <Text style={styles.codeChipText}>{code}</Text>
          </Surface>
        </View>
      </View>

      <Text style={styles.title}>{module.metadata.title}</Text>

      {/* The roster is a subscription and this player's seat can be a beat
          behind it — but a game screen is drawn *for* somebody, so it waits for
          the seat rather than inventing one. */}
      {player === undefined ? null : (
        <PlayerGameScreen module={module} state={state} player={player} />
      )}

      {youAreHost ? <BackToLobbyControl /> : null}
    </PhoneScreen>
  );
}

/**
 * The module's Controller screen, mounted on the state the room stored.
 *
 * `sendEvent` is the phone's way of telling the room what its player did. It is
 * fire-and-forget on purpose: the answer a player just gave comes back through
 * the room's own subscription, the same round trip the color swatches wait for,
 * so there is nothing here for the screen to wait on and nothing local to keep
 * in step. What the phone draws is always what the room says, never what this
 * phone hopes it said.
 *
 * A failure is swallowed rather than shown. Every refusal a game event can meet
 * is either the room having moved on — a beat the player can see for themselves
 * on the television — or this phone having lost its seat, which the screen
 * behind this one is already saying. An error card over four answer buttons
 * would interrupt the game to report something that no longer matters.
 */

function PlayerGameScreen({
  module,
  state,
  player,
}: {
  readonly module: GameModule;
  readonly state: unknown;
  readonly player: GamePlayer;
}) {
  const sendGameEvent = useMutation(api.games.sendEvent);

  function send(event: GameEvent) {
    void (async () => {
      try {
        const sessionToken = await phoneSessionTokenStore.read();

        if (sessionToken === null) {
          return;
        }

        await sendGameEvent({ sessionToken, event });
      } catch {
        // Deliberately silent — see above.
      }
    })();
  }

  // Mounted as a component rather than called as a function. The screen owns
  // hooks now (trivia's reveal beat), and calling it would register them on
  // this component's hook list instead of its own — making hook count a hidden
  // contract between the hub and every game it installs.
  const Controller = module.screens.controller;

  return (
    <View style={styles.gameStage}>
      <Controller state={state} player={player} sendEvent={send} />
    </View>
  );
}

/**
 * Back to lobby: the Host's way out of a running game, with
 * the room and its roster intact.
 *
 * On every beat the Host can be on, and deliberately: the room's other way
 * forward is the Reveal Beat, which comes from the phones, so a room whose
 * phones have all gone quiet has nothing left that can move it. This is the only
 * thing that can, and a control that only appeared once the game was over would
 * not be there for the beat that needs it.
 *
 * It keeps the punch face it wore as "End game", because on all but the last
 * beat it is still throwing away a game in progress — what changed is the word,
 * which now says where the room goes rather than mis-stating what it is doing
 * (see `backToLobbyLabel`). The roster, the Host and the Room Code survive it;
 * only the game's own state, the scoreboard included, is left behind.
 */

export function BackToLobbyControl() {
  const endGame = useMutation(api.games.endGame);
  const [returning, setReturning] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function backToLobby() {
    setReturning(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure('This phone has lost its seat — reopen the app to rejoin.');
        return;
      }

      await endGame({ sessionToken });
    } catch (error) {
      setFailure(lifecycleFailureMessage(error));
    } finally {
      setReturning(false);
    }
  }

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        disabled={returning}
        onPress={() => void backToLobby()}
        accessibilityRole="button"
        accessibilityState={{ disabled: returning }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[styles.stretch, [styles.button, styles.backToLobbyButton, pressed && styles.buttonPressed]]}>
            <Text style={styles.buttonLabel}>{backToLobbyLabel(returning)}</Text>
          </Surface>
        )}
      </Pressable>

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </View>
  );
}

/**
 * Who else is in the room, live.
 *
 * The seated screen subscribes to the same roster the TV draws its seats from,
 * because everything on it that can change without this phone doing anything is
 * on that one query: who is running the room, who has gone quiet, and who has
 * just walked in. So a handover and an arrival across the room both land as a
 * push, within a round trip of the room deciding them, rather than at the next
 * launch.
 *
 * **The unanswered moment is handed on rather than flattened**, which is the
 * whole reason this returns what it does. Every consumer that merely draws the
 * room wants an empty list as its neutral — no host to name, nobody to count —
 * but `useArrivals` has to tell "the room is empty" from "nobody has said yet",
 * and `[]` makes those the same snapshot. Fold `[]` as the baseline and the
 * first real answer reads as ten people walking in at once, which is precisely
 * the thing `just-joined.ts` exists to refuse. The television keeps the same
 * split for the same reason.
 */
