import { api } from '@huddle/convex';
import type {
  GameMetadata,
  GameSettings,
  GameSettingsPresentation,
  GameSettingsSchema,
  GameSetupMode,
} from '@huddle/game-core';
import { settingsFrom } from '@huddle/game-core';
import { type CarouselWindow, nextIndex, previousIndex } from '@huddle/game-registry';
import { colors, elevation, type IconName } from '@huddle/ui';
import {
  GameKeyArt,
  Icon,
  LoadingIndicator,
  Surface,
} from '@huddle/ui/native';
import {
  InfoChip,
  CategoryListRow,
  HuddleLogo,
  ModeCard,
  NavigationIconButton,
  QuestionStepper,
  SegmentedControl,
  StatusStrip,
} from '@huddle/ui/kit';
import { useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lifecycleFailureMessage } from '../../models';
import type { RosterSeat } from '../../models';
import { phoneSessionTokenStore } from '../../platform/session';
import {
  OutlinePill,
  PhoneScreen,
  PrimaryButton,
  SeatedHeader,
  controllerStyles as styles,
} from '../../ui/native';
import { CategoryPickerSheet } from './category-picker-sheet';
import {
  BACK_TO_ROOM,
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
  setupDraft,
  onChooseSetting,
  onBack,
}: {
  readonly browsing: CarouselWindow;
  readonly roster: readonly RosterSeat[];
  readonly settingsChoice: SettingsChoice | undefined;
  readonly setupDraft:
    | { readonly gameId: string; readonly settings: GameSettings; readonly mode: GameSetupMode }
    | null
    | undefined;
  readonly onChooseSetting: (next: (current: SettingsChoice | undefined) => SettingsChoice) => void;
  readonly onBack: () => void;
}) {
  const browseGame = useMutation(api.games.browseGame);
  const selectGame = useMutation(api.games.selectGame);
  const configureGame = useMutation(api.games.configureGame);
  const cancelGameSetup = useMutation(api.games.cancelGameSetup);
  const back = previousIndex(browsing.index);
  const on = nextIndex(browsing.index);
  // The room's setup draft is authoritative; `settingsChoice` is only the
  // optimistic mirror used while a configure mutation settles. Browsing remains
  // its own shared mutation, so the TV and every phone still follow the card.
  const { id: gameId } = browsing.focused.metadata;
  const { settingsSchema, settingsPresentation } = browsing.focused;
  const placeholder = browsing.focused.placeholder === true;
  const [mode, setMode] = useState<GameSetupMode>(setupDraft?.mode ?? 'standard');
  const activeMode = setupDraft?.gameId === gameId ? setupDraft.mode : mode;
  const selected = !placeholder && setupDraft?.gameId === gameId;
  const [selecting, setSelecting] = useState(false);
  const [selectionFailure, setSelectionFailure] = useState<string>();
  const announcedPicker = useRef(false);

  // Opening the picker is itself shared room state: the TV must leave the
  // roster for the carousel before the Host taps an arrow. Announce the
  // current card once per picker mount; later cards are announced by `browse`.
  useEffect(() => {
    if (announcedPicker.current) return;
    announcedPicker.current = true;

    void (async () => {
      const sessionToken = await phoneSessionTokenStore.read();
      if (sessionToken !== null) {
        try {
          await browseGame({ sessionToken, index: browsing.index });
        } catch {
          // The room subscription remains authoritative; an arrow tap can
          // retry the same announcement without trapping the Host here.
        }
      }
    })();
  }, [browseGame, browsing.index]);

  const currentSettings =
    setupDraft?.gameId === gameId ? setupDraft.settings : settingsToStart(settingsSchema, gameId, settingsChoice);

  async function selectCurrentGame() {
    if (placeholder) {
      setSelectionFailure(`${browsing.focused.metadata.title} is coming soon.`);
      return;
    }

    setSelecting(true);
    setSelectionFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();
      if (sessionToken === null) {
        setSelectionFailure('This phone has lost its seat — reopen the app to rejoin.');
        return;
      }

      await selectGame({ sessionToken, gameId, mode: 'standard' });
      setMode('standard');
    } catch (error) {
      setSelectionFailure(lifecycleFailureMessage(error));
    } finally {
      setSelecting(false);
    }
  }

  async function configure(settings: GameSettings, nextMode: GameSetupMode = activeMode) {
    const sessionToken = await phoneSessionTokenStore.read();
    if (sessionToken === null) return;
    try {
      await configureGame({ sessionToken, gameId, settings, mode: nextMode });
    } catch {
      // A failed draft update is reflected by the next authoritative snapshot.
    }
  }

  function chooseMode(nextMode: GameSetupMode) {
    if (!selected) return;
    setMode(nextMode);
    const preset = settingsPresentation?.presets?.find((candidate) => candidate.mode === nextMode);
    if (preset !== undefined) {
      onChooseSetting(() => ({ gameId, settings: preset.settings }));
      void configure(preset.settings, nextMode);
      return;
    }
    const nextSettings =
      nextMode === 'custom'
        ? customSettings(settingsSchema, settingsPresentation, currentSettings)
        : currentSettings;
    onChooseSetting(() => ({ gameId, settings: nextSettings }));
    void configure(nextSettings, nextMode);
  }

  async function browse(to: number | undefined) {
    if (to === undefined) {
      return;
    }

    const sessionToken = await phoneSessionTokenStore.read();

    if (sessionToken !== null) {
      await browseGame({ sessionToken, index: to });
    }
  }

  async function backFromSetup() {
    const sessionToken = await phoneSessionTokenStore.read();
    if (sessionToken !== null) {
      try {
        await cancelGameSetup({ sessionToken });
      } catch {
        // The room subscription remains the source of truth.
      }
    }
    onBack();
  }

  async function changeGame() {
    const sessionToken = await phoneSessionTokenStore.read();
    if (sessionToken === null) {
      setSelectionFailure('This phone has lost its seat — reopen the app to rejoin.');
      return;
    }

    try {
      await cancelGameSetup({ sessionToken });
    } catch (error) {
      setSelectionFailure(lifecycleFailureMessage(error));
    }
  }

  if (selected) {
    return (
      <GameSettingsScreen
        metadata={browsing.focused.metadata}
        schema={settingsSchema}
        presentation={settingsPresentation}
        mode={activeMode}
        settings={currentSettings}
        settingsChoice={settingsChoice}
        roster={roster}
        browsingAt={browsing.index}
        failure={selectionFailure}
        onChooseMode={chooseMode}
        onChooseSetting={(key, value) =>
          onChooseSetting((current) => {
            const next = settingChosen(gameId, current, key, value);
            void configure(next.settings);
            return next;
          })
        }
        onChangeGame={() => void changeGame()}
      />
    );
  }

  return (
    <PhoneScreen>
      <SeatedHeader trailing={<OutlinePill label={BACK_TO_ROOM} onPress={() => void backFromSetup()} />} />

      <Text style={styles.pickingLabel}>YOU’RE THE HOST — PICK A GAME</Text>

      <GameCard metadata={browsing.focused.metadata} placeholder={placeholder} />

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

      <View style={styles.field}>
        <PrimaryButton
          label={
            placeholder
              ? 'Coming soon'
              : selecting
                ? 'Selecting…'
                : `Select ${browsing.focused.metadata.title}`
          }
          trailingIcon={placeholder ? undefined : 'arrow-right'}
          enabled={!selecting && !placeholder}
          onPress={() => void selectCurrentGame()}
        />
        {selectionFailure === undefined ? null : (
          <Text style={styles.failure} accessibilityLiveRegion="polite">
            {selectionFailure}
          </Text>
        )}
      </View>

    </PhoneScreen>
  );
}

function GameSettingsScreen({
  metadata,
  schema,
  presentation,
  mode,
  settings,
  settingsChoice,
  roster,
  browsingAt,
  failure,
  onChooseMode,
  onChooseSetting,
  onChangeGame,
}: {
  readonly metadata: GameMetadata;
  readonly schema: GameSettingsSchema;
  readonly presentation: GameSettingsPresentation | undefined;
  readonly mode: GameSetupMode;
  readonly settings: GameSettings;
  readonly settingsChoice: SettingsChoice | undefined;
  readonly roster: readonly RosterSeat[];
  readonly browsingAt: number;
  readonly failure: string | undefined;
  readonly onChooseMode: (mode: GameSetupMode) => void;
  readonly onChooseSetting: (key: string, value: string) => void;
  readonly onChangeGame: () => void;
}) {
  return (
    <PhoneScreen contentStyle={styles.settingsScreenContent}>
      <View style={styles.settingsScreenHeader}>
        <RoundButton
          icon="chevron-left"
          spokenAs="Back to game picker"
          enabled
          onPress={onChangeGame}
        />
        <HuddleLogo size={28} />
        <View style={styles.settingsHeaderBalance} />
      </View>

      <SelectedGameSummary metadata={metadata} onChangeGame={onChangeGame} />

      <Text style={styles.settingsScreenTitle}>How do you want to play?</Text>
      <ModeTabs mode={mode} onChoose={onChooseMode} />

      {mode === 'custom' ? (
        <SettingsControls
          schema={schema}
          gameId={metadata.id}
          choice={{
            gameId: metadata.id,
            settings:
              settingsChoice?.gameId === metadata.id ? settingsChoice.settings : settings,
          }}
          presentation={presentation}
          onChoose={onChooseSetting}
        />
      ) : (
        <PresetSummary
          schema={schema}
          settings={settings}
          onCustomize={mode === 'standard' ? () => onChooseMode('custom') : undefined}
        />
      )}

      <StatusStrip variant="success" style={styles.joiningNotice}>
        Players can keep joining until you start.
      </StatusStrip>

      <StartGameControl
        roster={roster}
        browsingAt={browsingAt}
        selected
        title={mode === 'quick' ? `Quick ${metadata.title}` : metadata.title}
      />

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </PhoneScreen>
  );
}

function SelectedGameSummary({
  metadata,
  onChangeGame,
}: {
  readonly metadata: GameMetadata;
  readonly onChangeGame: () => void;
}) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = metadata;

  return (
    <Surface elevation={elevation.phoneSmall} style={styles.selectedGameSummary}>
      <View style={[styles.selectedGameArt, { backgroundColor: colors[keyArt.color] }]}>
        <GameKeyArt
          gameId={metadata.id}
          title={title}
          color={keyArt.color}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.selectedGameCopy}>
        <Text style={styles.selectedGameTitle}>{title}</Text>
        <Text style={styles.selectedGameMeta}>
          {playerRange.min}–{playerRange.max} players · {estimatedMinutes} min · {category}
        </Text>
        <View style={styles.selectedGameFacts}>
          <InfoChip
            icon="players"
            label={`${playerRange.min}–${playerRange.max}`}
            style={styles.selectedGameFact}
          />
          <InfoChip icon="clock" label={`${estimatedMinutes} min`} style={styles.selectedGameFact} />
          <InfoChip icon="category" label={category} style={styles.selectedGameFact} />
        </View>
        <Pressable
          style={styles.changeGameAction}
          onPress={onChangeGame}
          accessibilityRole="button"
          accessibilityLabel="Change game"
        >
          <Text style={styles.changeGameText}>Change</Text>
          <Icon name="chevron-right" size={18} color={colors.accent} />
        </Pressable>
      </View>
    </Surface>
  );
}

/** Reset preset-only values before moving into the narrower custom shell. */
function customSettings(
  schema: GameSettingsSchema,
  presentation: GameSettingsPresentation | undefined,
  current: GameSettings,
): GameSettings {
  const next = { ...current };
  const customKeys = presentation?.customSettingKeys;

  for (const setting of schema) {
    if (customKeys !== undefined && !customKeys.includes(setting.key)) {
      next[setting.key] = setting.defaultValue;
      continue;
    }

    const allowed = presentation?.customOptions?.[setting.key];
    if (allowed !== undefined && !allowed.includes(next[setting.key] ?? '')) {
      next[setting.key] = allowed.includes(setting.defaultValue)
        ? setting.defaultValue
        : (allowed[0] ?? setting.defaultValue);
    }
  }

  return settingsFrom(schema, next);
}

function PresetSummary({
  schema,
  settings,
  onCustomize,
}: {
  readonly schema: GameSettingsSchema;
  readonly settings: GameSettings;
  readonly onCustomize?: () => void;
}) {
  const rows = schema.filter((setting) => setting.key !== 'scoring');
  return (
    <View style={styles.presetGroup}>
      <View style={styles.presetSummary}>
        {rows.map((setting) => {
          const value =
            setting.options.find((option) => option.value === settings[setting.key])?.label ??
            settings[setting.key];
          return (
            <View key={setting.key} style={styles.presetRow}>
              <Icon name={settingSummaryIcon(setting.label)} size={22} color={colors.ink} />
              <Text style={styles.presetValue}>
                {settingSummaryCopy(setting.label, value)}
              </Text>
            </View>
          );
        })}
      </View>
      {onCustomize === undefined ? null : (
        <Pressable
          style={styles.customizeSettings}
          onPress={onCustomize}
          accessibilityRole="button"
        >
          <Text style={styles.customizeSettingsText}>Customize settings</Text>
        </Pressable>
      )}
    </View>
  );
}

function settingSummaryIcon(label: string): IconName {
  if (label === 'Time per question') return 'clock';
  if (label === 'Category') return 'tag';
  if (label === 'Difficulty') return 'scan';
  return 'gamepad';
}

function settingSummaryCopy(label: string, value: string | undefined): string {
  const shown = value ?? '—';
  if (label === 'Questions') return `${shown} questions`;
  if (label === 'Difficulty') return `${shown} difficulty`;
  if (label === 'Time per question') return `${shown} per question`;
  if (label === 'Category') return `Category: ${shown}`;
  return `${label}: ${shown}`;
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

function GameCard({
  metadata,
  placeholder,
}: {
  readonly metadata: GameMetadata;
  readonly placeholder: boolean;
}) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = metadata;

  return (
    <Surface
      elevation={elevation.phoneCard}
      style={[styles.stretch, styles.gameCard, { backgroundColor: colors[keyArt.color] }]}
    >
      <View style={styles.gameCardArt}>
        <GameKeyArt
          gameId={metadata.id}
          title={title}
          color={keyArt.color}
          style={StyleSheet.absoluteFill}
        />
        {placeholder ? (
          <View style={styles.gameCardPlaceholder}>
            <Text style={styles.gameCardPlaceholderText}>COMING SOON</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.gameCardFooter, { backgroundColor: colors[keyArt.color] }]}>
        <Text style={styles.gameCardTitle}>{title}</Text>
        <View style={styles.gameCardChips}>
          <GameCardChip icon="players" label={`${playerRange.min}–${playerRange.max} players`} />
          <GameCardChip icon="clock" label={`${estimatedMinutes} min`} />
          <GameCardChip icon="tag" label={category} />
        </View>
      </View>
    </Surface>
  );
}

/** One fact about a game, on the card's own art. */

function GameCardChip({ icon, label }: { readonly icon: IconName; readonly label: string }) {
  return (
    <View style={styles.gameCardChip}>
      <View style={[StyleSheet.absoluteFill, styles.gameCardChipWash]} />
      <Icon name={icon} size={14} color={colors.inverse} />
      <Text style={styles.gameCardChipText}>{label}</Text>
    </View>
  );
}

function ModeTabs({
  mode,
  onChoose,
}: {
  readonly mode: GameSetupMode;
  readonly onChoose: (mode: GameSetupMode) => void;
}) {
  return (
    <View style={styles.modeTabs} accessibilityRole="tablist">
      {(['quick', 'standard', 'custom'] as const).map((candidate) => (
        <View key={candidate} style={styles.modeTabPressable}>
          <ModeCard
            mode={candidate}
            selected={mode === candidate}
            onPress={() => onChoose(candidate)}
            style={{ flex: 1, minWidth: 0 }}
          />
        </View>
      ))}
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
  presentation,
  onChoose,
}: {
  readonly schema: GameSettingsSchema;
  readonly gameId: string;
  readonly choice: SettingsChoice | undefined;
  readonly presentation?: GameSettingsPresentation;
  readonly onChoose: (key: string, value: string) => void;
}) {
  const controls = settingsControls(schema, gameId, choice, presentation);
  const [pickerKey, setPickerKey] = useState<string>();

  if (controls.length === 0) {
    return null;
  }

  return (
    <View style={styles.settingsPanel}>
      {controls.map((control, index) => {
        const chosenIndex = control.options.findIndex((option) => option.chosen);
        const chosen = control.options[chosenIndex];
        const isStepper = control.options.every((option) => /^\d+$/u.test(option.label));
        const isCollapsedChoice = control.options.length > 4;
        const numericValues = control.options.map((option) => Number(option.label));
        const firstNumeric = numericValues[0] ?? 0;
        const secondNumeric = numericValues[1] ?? firstNumeric;
        const numericStep = numericValues.length > 1 ? secondNumeric - firstNumeric : 1;

        return (
        <View
          key={control.key}
          style={[styles.settingRow, index > 0 && styles.settingRowRuled]}
        >
          <Text style={styles.settingLabel}>{control.label}</Text>
          {isStepper ? (
            <QuestionStepper
              value={Number(chosen?.label ?? numericValues[0] ?? 0)}
              min={numericValues[0] ?? 0}
              max={numericValues[numericValues.length - 1] ?? 0}
              step={numericStep}
              onChange={(value) => {
                const next = control.options.find((option) => Number(option.label) === value);
                if (next !== undefined) onChoose(control.key, next.value);
              }}
            />
          ) : isCollapsedChoice ? (
            <View style={styles.collapsedSetting}>
              <CategoryListRow
                style={styles.collapsedSettingButton}
                label={chosen?.label ?? 'Choose'}
                onPress={() => setPickerKey(control.key)}
              />
              <CategoryPickerSheet
                visible={pickerKey === control.key}
                title={`Choose ${control.label.toLowerCase()}`}
                options={control.options}
                selectedValue={chosen?.value}
                onSelect={(value) => onChoose(control.key, value)}
                onDismiss={() => setPickerKey(undefined)}
              />
            </View>
          ) : (
            <SegmentedControl
              options={control.options.map((option) => option.label)}
              value={chosen?.label ?? control.options[0]?.label ?? ''}
              onChange={(label) => {
                const next = control.options.find((option) => option.label === label);
                if (next !== undefined) onChoose(control.key, next.value);
              }}
            />
          )}
        </View>
        );
      })}
    </View>
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
    <NavigationIconButton
      icon={icon === 'chevron-left' ? 'carousel-left' : 'carousel-right'}
      disabled={!enabled}
      onPress={onPress}
      size={56}
      style={[styles.roundButton, !enabled && styles.buttonUnavailable]}
      accessibilityLabel={spokenAs}
    />
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
  selected,
  title,
}: {
  readonly roster: readonly RosterSeat[];
  readonly browsingAt: number;
  readonly selected: boolean;
  readonly title: string;
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

      // The shared Convex draft is authoritative. This avoids starting on a
      // stale local settings snapshot while the latest chip mutation is still
      // settling on the room.
      await startGame({ sessionToken });
    } catch (error) {
      setFailure(lifecycleFailureMessage(error));
    } finally {
      setStarting(false);
    }
  }

  const pressable = selected && control.enabled && !starting;

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        disabled={!pressable}
        onPress={() => void start()}
        accessibilityRole="button"
        accessibilityState={{ disabled: !pressable, busy: starting }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[[styles.stretch, !pressable && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
            {starting ? (
              <LoadingIndicator size="small" color={colors.inverse} label="Starting game" />
            ) : null}
            <Text style={styles.buttonLabel}>
              {starting ? 'Starting…' : `Start ${title}`}
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
