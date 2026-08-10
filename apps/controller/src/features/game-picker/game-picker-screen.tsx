import { api } from '@huddle/convex';
import type { GameMetadata, GameSettings, GameSettingsSchema } from '@huddle/game-core';
import { type CarouselWindow, nextIndex, previousIndex } from '@huddle/game-registry';
import { colors, elevation, type IconName } from '@huddle/ui';
import { Icon, Surface } from '@huddle/ui/native';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lifecycleFailureMessage } from '../game-session';
import type { RosterSeat } from '../room';
import { phoneSessionTokenStore } from '../../platform/session';
import { OutlinePill, PhoneScreen, SeatedHeader, controllerStyles as styles } from '../../ui';
import {
  BACK_TO_ROOM,
  gameToStart,
  settingChosen,
  settingsControls,
  settingsToStart,
  startControl,
  type SettingsChoice,
} from './index';

export function PickAGameScreen({
  browsing,
  roster,
  settingsChoice,
  onChooseSetting,
  onBack,
}: {
  readonly browsing: CarouselWindow;
  readonly roster: readonly RosterSeat[];
  readonly settingsChoice: SettingsChoice | undefined;
  readonly onChooseSetting: (next: (current: SettingsChoice | undefined) => SettingsChoice) => void;
  readonly onBack: () => void;
}) {
  const browseGame = useMutation(api.games.browseGame);
  const back = previousIndex(browsing.index);
  const on = nextIndex(browsing.index);
  // The Host's settings live on this phone and nowhere else — see
  // `settings-choice`. They travel as one argument of `startGame`, so browsing
  // stays exactly what it was before this screen gained settings: a mutation of
  // its own that the TV and every other phone follow, and that nothing here
  // touches.
  const { id: gameId } = browsing.focused.metadata;
  const { settingsSchema } = browsing.focused;

  async function browse(to: number | undefined) {
    if (to === undefined) {
      return;
    }

    const sessionToken = await phoneSessionTokenStore.read();

    if (sessionToken !== null) {
      await browseGame({ sessionToken, index: to });
    }
  }

  return (
    <PhoneScreen>
      <SeatedHeader trailing={<OutlinePill label={BACK_TO_ROOM} onPress={onBack} />} />

      <Text style={styles.pickingLabel}>YOU’RE THE HOST — PICK A GAME</Text>

      <GameCard metadata={browsing.focused.metadata} />

      <View style={styles.pickerRow}>
        <RoundButton
          icon="chevron-left"
          spokenAs="Previous game"
          enabled={back !== undefined}
          onPress={() => void browse(back)}
        />
        <Text style={styles.pickedPosition}>
          {browsing.index + 1} / {browsing.total}
        </Text>
        <RoundButton
          icon="chevron-right"
          spokenAs="Next game"
          enabled={on !== undefined}
          onPress={() => void browse(on)}
        />
      </View>

      <Text style={[styles.aside, styles.asideCentred]}>
        Swipe or tap arrows — the TV follows along
      </Text>

      <SettingsControls
        schema={settingsSchema}
        gameId={gameId}
        choice={settingsChoice}
        // Chosen from the choice React holds rather than the one this render
        // closed over: two chips tapped in the same beat both count.
        onChoose={(key, value) =>
          onChooseSetting((current) => settingChosen(gameId, current, key, value))
        }
      />

      <StartGameControl
        roster={roster}
        browsingAt={browsing.index}
        settings={settingsToStart(settingsSchema, gameId, settingsChoice)}
      />
    </PhoneScreen>
  );
}

/**
 * Phone — everybody who is not running the room (the approved board's
 * "Waiting").
 *
 * The Host's face rather than the reader's own, because the sentence under it
 * names the Host: this screen is about the person the room is waiting on, and a
 * player looking at their own avatar over "Sam is choosing…" would be reading
 * two different people. Their own avatar is on the television, at the size the
 * room is actually looking at.
 *
 * There is nothing to press here *about the game*, which is most of the screen,
 * and the card at the foot is what says so out loud rather than leaving it as
 * an absence. The one control is Leave, in the header, where it is on every
 * other seated screen too.
 */

function GameCard({ metadata }: { readonly metadata: GameMetadata }) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = metadata;

  return (
    <Surface
      elevation={elevation.phoneCard}
      style={[styles.stretch, styles.gameCard, { backgroundColor: colors[keyArt.color] }]}>
      <Text style={styles.gameCardTitle}>{title}</Text>

      <View style={styles.gameCardChips}>
        <GameCardChip icon="players" label={`${playerRange.min}–${playerRange.max} players`} />
        <GameCardChip icon="clock" label={`${estimatedMinutes} min`} />
        <GameCardChip icon="tag" label={category} />
      </View>
    </Surface>
  );
}

/** One fact about a game, on the card's own art. */

function GameCardChip({ icon, label }: { readonly icon: IconName; readonly label: string }) {
  return (
    <View style={styles.gameCardChip}>
      <View style={[StyleSheet.absoluteFill, styles.gameCardChipWash]} />
      <Icon name={icon} size={14} color={colors.ink} />
      <Text style={styles.gameCardChipText}>{label}</Text>
    </View>
  );
}

/**
 * This phone gives up its seat (the scope's "leave").
 *
 * It replaced End room, and it is a different kind of control: End room was the
 * Host's alone and deleted every seat in the room, where this deletes exactly
 * one — the reader's. So it is on every seated screen rather than the Host's,
 * and the confirm it stands behind warns about what the reader is giving up
 * instead of what is being done to everybody else.
 *
 * It keeps the header slot and the outlined pill the board draws, and it keeps
 * the confirm. A tap that costs a seat is still worth a second one — the room
 * has no undo, only a rejoin — but it is no longer the room's irreversible act.
 * Even the last seat leaves the TV-owned room and code open.
 */

function SettingsControls({
  schema,
  gameId,
  choice,
  onChoose,
}: {
  readonly schema: GameSettingsSchema;
  readonly gameId: string;
  readonly choice: SettingsChoice | undefined;
  readonly onChoose: (key: string, value: string) => void;
}) {
  const controls = settingsControls(schema, gameId, choice);

  if (controls.length === 0) {
    return null;
  }

  return (
    <View style={styles.settings}>
      <Text style={styles.label}>SETTINGS</Text>

      {controls.map((control) => (
        <View key={control.key} style={styles.setting}>
          <Text style={styles.settingLabel}>{control.label}</Text>
          <View style={styles.settingOptions}>
            {control.options.map((option) => (
              <SettingOption
                key={option.value}
                label={option.label}
                // Which setting this value belongs to, for a screen reader —
                // three settings' chips are one flat list of buttons to it, and
                // "Movies, selected" alone says nothing about what it sets.
                spokenAs={`${control.label}: ${option.label}`}
                chosen={option.chosen}
                onPress={() => onChoose(control.key, option.value)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * One value of one setting, as Soft Minimal draws a choice: the chosen chip is
 * accented and sits on its own shadow, while the rest are white and flat. The
 * sticker shadow lifts the thing that is currently true off the ones that
 * merely could be.
 */

function SettingOption({
  label,
  spokenAs,
  chosen,
  onPress,
}: {
  readonly label: string;
  /** The label read aloud: the setting this value belongs to, and the value. */
  readonly spokenAs: string;
  readonly chosen: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spokenAs}
      accessibilityState={{ selected: chosen }}
    >
      {({ pressed }) =>
        chosen ? (
          <Surface
            elevation={elevation.phoneSmall}
            style={[
              styles.settingOption,
              styles.settingOptionChosen,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.settingOptionLabel, styles.settingOptionLabelChosen]}>
              {label}
            </Text>
          </Surface>
        ) : (
          // No press travel on the flat chip. Soft Minimal's press is a sticker
          // going down onto its own shadow, and
          // a chip that has no shadow to meet would just slide 3px sideways.
          <View style={styles.settingOption}>
            <Text style={styles.settingOptionLabel}>{label}</Text>
          </View>
        )
      }
    </Pressable>
  );
}

/**
 * One of the picker's round buttons.
 *
 * The chevron is an icon rather than a `‹` typed in the body face, which is
 * what it was: a glyph borrowed from a text font is whatever weight and
 * optical centre that font happens to give it, and it drifted from the arrow
 * beside it on the primary button. Both are now the same drawing at two sizes.
 *
 * It carries its own spoken name because the glyph is the whole control — there
 * is no text beside it to read instead.
 */

function RoundButton({
  icon,
  spokenAs,
  enabled,
  onPress,
}: {
  readonly icon: IconName;
  readonly spokenAs: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spokenAs}
      accessibilityState={{ disabled: !enabled }}
    >
      {({ pressed }) => (
        <Surface
          elevation={elevation.phoneSmall}
          style={[enabled ? undefined : styles.buttonUnavailable, [styles.roundButton, pressed && styles.buttonPressed]]}>
          <Icon name={icon} size={26} color={colors.ink} />
        </Surface>
      )}
    </Pressable>
  );
}

/**
 * Which seats this phone has watched arrive, folded from the roster snapshots
 * the subscription pushes.
 *
 * The television's own hook, on the phone now that the Host's roster draws the
 * JUST JOINED chip too. Folded during render and stored, so it settles rather
 * than loops: `noteArrivals` hands back the identical value whenever a snapshot
 * seats nobody, which is most of them.
 */

function StartGameControl({
  roster,
  browsingAt,
  settings,
}: {
  readonly roster: readonly RosterSeat[];
  readonly browsingAt: number;
  /** What the controls above are showing: the settings the room starts on. */
  readonly settings: GameSettings;
}) {
  const startGame = useMutation(api.games.startGame);
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string>();
  const control = startControl(roster, browsingAt);

  async function start() {
    setStarting(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure('This phone has lost its seat — reopen the app to rejoin.');
        return;
      }

      const game = gameToStart(browsingAt);

      if (game !== undefined) {
        await startGame({ sessionToken, gameId: game.id, settings });
      }
    } catch (error) {
      setFailure(lifecycleFailureMessage(error));
    } finally {
      setStarting(false);
    }
  }

  const pressable = control.enabled && !starting;

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        disabled={!pressable}
        onPress={() => void start()}
        accessibilityRole="button"
        accessibilityState={{ disabled: !pressable }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[[styles.stretch, !control.enabled && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
            <Text style={styles.buttonLabel}>
              {starting ? 'Starting…' : control.label}
            </Text>
          </Surface>
        )}
      </Pressable>

      {control.blockedBecause === undefined ? null : (
        <Text style={styles.waitingFor}>{control.blockedBecause}</Text>
      )}

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </View>
  );
}

/**
 * The phone while a game is running: the game's own screen, and — for the Host
 * — the way back to the lobby.
 *
 * The frame around the module is the hub's and says only what `GameMetadata`
 * already told it, which is the point: this screen does not know what game it
 * is drawing — nor which beat of it the player is on, which is why the Host's
 * control below reads the same on all of them.
 */
