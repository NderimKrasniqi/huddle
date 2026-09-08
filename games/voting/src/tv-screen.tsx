import type { TvGameScreenProps } from '@huddle/domain';
import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import { AvatarPortrait, Badge, HEARTBEAT_ARTWORK, HuddleText } from '@huddle/ui/native';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';

import { playableVotingState } from './state';
import { votingOptionIcon, votingRecapIcon } from './option-icon';
import type { VotingState } from './types';
import { votingTvModel, type VotingTallyOption, type VotingTvModel } from './watching';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const OVERSCAN_X = 96;
const OVERSCAN_Y = 54;

/** Shared Voting stage. It is a pure, non-focusable presentation surface. */
export function VotingTvScreen({ state, players, clockRemainingMs }: TvGameScreenProps<VotingState>) {
  const viewport = useWindowDimensions();
  const current = playableVotingState(state);
  const countdown = useCountdownSeconds(
    current?.phase === 'vote' && current.voteSeconds !== 'none' ? clockRemainingMs : undefined,
    current?.phase === 'vote' && current.voteSeconds !== 'none' ? current.voteSeconds : 0,
    current === undefined ? 'legacy' : `${current.roundIndex}:${current.phase}`,
  );
  const model = votingTvModel(
    state,
    players,
    current?.phase === 'vote' && current.voteSeconds !== 'none' ? countdown * 1000 : clockRemainingMs,
  );
  const scale = safeScale(viewport.width, viewport.height);

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="voting-tv-screen">
      <View style={[styles.stage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false}>
        <ImageBackground source={HEARTBEAT_ARTWORK.gameWorlds.voting} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} testID="voting-tv-world" />
        <View style={styles.safeFrame} pointerEvents="none" focusable={false}>
          <HuddleText variant="caption" color="text" style={styles.stageLabel} accessibilityElementsHidden>HUDDLE · VOTING</HuddleText>
          {model.kind === 'legacy' ? <LegacyStage rounds={model.rounds} /> : null}
          {model.kind === 'intro' ? <IntroStage model={model} players={players} /> : null}
          {model.kind === 'vote' ? <VoteStage model={model} players={players} /> : null}
          {model.kind === 'reveal' ? <RevealStage model={model} /> : null}
          {model.kind === 'finished' ? <FinishedStage model={model} /> : null}
        </View>
      </View>
    </View>
  );
}

function LegacyStage({ rounds }: { readonly rounds: 3 | 5 }) {
  return (
    <View style={styles.legacyBoard} accessible accessibilityRole="text" accessibilityLabel={`Voting needs an update. Room needs an update. This earlier room was set for ${rounds} rounds. Return to the room to start again.`}>
      <Badge label="VOTING" tone="away" />
      <HuddleText variant="tvDisplay" color="text" align="center">Room needs an update</HuddleText>
      <HuddleText variant="bodyLarge" color="text" align="center">This earlier room was set for {rounds} rounds. Return to the room to start again.</HuddleText>
    </View>
  );
}

function IntroStage({
  model,
  players,
}: {
  readonly model: Extract<VotingTvModel, { kind: 'intro' }>;
  readonly players: TvGameScreenProps<VotingState>['players'];
}) {
  return (
    <View style={styles.introStage} accessible accessibilityRole="text" accessibilityLabel={`Voting ready. Get ready to vote! ${model.rounds} rounds. ${model.playerCount} players. Phones hold each private choice. The room shares the result here. ${model.voteSeconds === 'none' ? 'No visible timer' : `${model.voteSeconds} seconds`}. ${model.results === 'live' ? 'Live tally' : 'Reveal together'}. ${model.voterLabels === 'afterReveal' ? 'Names after reveal' : 'Labels hidden'}.`}>
      <View style={styles.introBoard} pointerEvents="none" focusable={false}>
        <View style={styles.gameBrand} pointerEvents="none" focusable={false}>
          <View style={styles.brandMark} />
          <HuddleText variant="title" color="text">Voting</HuddleText>
        </View>
        <Badge label="VOTING" tone="host" />
        <HuddleText variant="tvDisplay" color="text" align="center">Get ready to vote!</HuddleText>
        <HuddleText variant="bodyLarge" color="text" align="center">Phones hold each private choice. The room shares the result here.</HuddleText>
        <View style={styles.introSettings} pointerEvents="none" focusable={false}>
          <Badge label={`${model.rounds} rounds`} tone="neutral" />
          <Badge label={model.voteSeconds === 'none' ? 'No visible timer' : `${model.voteSeconds} seconds`} tone="neutral" />
          <Badge label={model.results === 'live' ? 'Live tally' : 'Reveal together'} tone="neutral" />
          <Badge label={model.voterLabels === 'afterReveal' ? 'Names after reveal' : 'Labels hidden'} tone="neutral" />
        </View>
        <PlayerAvatarStrip players={players} testID="voting-tv-intro-avatars" />
      </View>
    </View>
  );
}

function VoteStage({
  model,
  players,
}: {
  readonly model: Extract<VotingTvModel, { kind: 'vote' }>;
  readonly players: TvGameScreenProps<VotingState>['players'];
}) {
  return (
    <View style={styles.content} accessible accessibilityRole="text" accessibilityLabel={voteAccessibilityLabel(model)}>
      <View style={styles.topRow} pointerEvents="none" focusable={false}>
        <View style={styles.headingCopy}>
          <HuddleText variant="caption" color="text" style={styles.kicker}>ROUND {model.roundIndex + 1} OF {model.roundCount}</HuddleText>
          <HuddleText variant="title" color="text">Choose on your phone</HuddleText>
        </View>
        <View style={styles.topMeta}>
          {model.live ? <Badge label="LIVE TALLY" tone="host" /> : <Badge label="REVEAL TOGETHER" tone="neutral" />}
          <View style={styles.timerPill}>
            <HuddleText variant="hero" color="surface">{model.countdownSeconds ?? '∞'}</HuddleText>
            <HuddleText variant="caption" color="surface">{model.countdownSeconds === undefined ? 'RELAXED' : 'SEC'}</HuddleText>
          </View>
        </View>
      </View>
      <View style={styles.promptPanel} pointerEvents="none" focusable={false}><HuddleText variant="display" color="text" align="center">{model.text}</HuddleText></View>
      <View style={styles.optionRow} pointerEvents="none" focusable={false} testID="voting-tv-option-grid">
        {model.options.map((option) => <OptionCard key={option.optionIndex} option={option} showResults={model.live} />)}
      </View>
      <View style={styles.participationRow} pointerEvents="none" focusable={false}>
        <View style={styles.participationCopy} pointerEvents="none" focusable={false}>
          <Badge label={`${model.voted}/${model.playerCount} voted`} tone={model.voted === model.playerCount ? 'ready' : 'host'} />
          <HuddleText variant="bodyLarge" color="text">Votes stay private; only the room’s aggregate appears here.</HuddleText>
        </View>
        <PlayerAvatarStrip players={players} testID="voting-tv-vote-avatars" />
      </View>
    </View>
  );
}

function RevealStage({ model }: { readonly model: Extract<VotingTvModel, { kind: 'reveal' }> }) {
  return (
    <View style={styles.content} accessible accessibilityRole="text" accessibilityLabel={revealAccessibilityLabel(model)}>
      <View style={styles.topRow} pointerEvents="none" focusable={false}>
        <View style={styles.headingCopy}>
          <HuddleText variant="caption" color="text" style={styles.kicker}>ROUND {model.roundIndex + 1} OF {model.roundCount}</HuddleText>
          <HuddleText variant="title" color="text">The room has spoken</HuddleText>
        </View>
        <Badge label={model.labelsShown ? 'NAMES AFTER REVEAL' : 'SHARED RESULT'} tone="ready" />
      </View>
      <View style={styles.promptPanel} pointerEvents="none" focusable={false}><HuddleText variant="display" color="text" align="center">{model.text}</HuddleText></View>
      <View style={styles.optionRow} pointerEvents="none" focusable={false} testID="voting-tv-reveal-grid">
        {model.options.map((option) => <OptionCard key={option.optionIndex} option={option} showResults showNames={model.labelsShown} />)}
      </View>
      <View style={styles.participationRow} pointerEvents="none" focusable={false}>
        <Badge label={`${model.voted}/${model.playerCount} voted`} tone="ready" />
        <HuddleText variant="bodyLarge" color="text">No scores. No winner. Just the room’s vibe.</HuddleText>
      </View>
    </View>
  );
}

function OptionCard({ option, showResults, showNames = false }: { readonly option: VotingTallyOption; readonly showResults: boolean; readonly showNames?: boolean }) {
  const visibleNames = visibleVoterNames(option);
  return (
    <View style={styles.optionCard} pointerEvents="none" focusable={false} testID={`voting-tv-option-${option.optionIndex}`}>
      <HuddleText variant="hero" style={styles.optionIcon} accessibilityElementsHidden>{votingOptionIcon(option.text)}</HuddleText>
      <HuddleText variant="title" color="text" align="center" numberOfLines={2}>{option.text}</HuddleText>
      {showResults ? (
        <>
          <View style={styles.tallyTrack} pointerEvents="none" focusable={false}><View style={[styles.tallyFill, { width: `${option.percent ?? 0}%` }]} /></View>
          <HuddleText variant="hero" color="text" align="center">{option.percent ?? 0}%</HuddleText>
          <HuddleText variant="body" color="text" align="center">{option.count ?? 0} vote{option.count === 1 ? '' : 's'}</HuddleText>
          {showNames && visibleNames !== '' ? (
            <View style={styles.voterLabels} pointerEvents="none" focusable={false}>
              <VoterAvatarStrip voters={option.voters} />
              <HuddleText variant="caption" color="text" align="center" numberOfLines={2} testID={`voting-tv-labels-${option.optionIndex}`}>{visibleNames}</HuddleText>
            </View>
          ) : null}
        </>
      ) : (
        <HuddleText variant="body" color="text" align="center" style={styles.dimCopy}>Waiting for the room</HuddleText>
      )}
    </View>
  );
}

function PlayerAvatarStrip({
  players,
  testID,
}: {
  readonly players: TvGameScreenProps<VotingState>['players'];
  readonly testID?: string;
}) {
  if (players.length === 0) return null;

  return (
    <View style={styles.avatarStrip} pointerEvents="none" focusable={false} testID={testID}>
      {players.slice(0, 10).map((player) => (
        <AvatarPortrait
          key={player.playerId}
          avatarId={player.avatar}
          displayName={player.nickname}
          size={44}
          disabled={player.away}
        />
      ))}
    </View>
  );
}

function VoterAvatarStrip({
  voters,
}: {
  readonly voters: VotingTallyOption['voters'];
}) {
  if (voters.length === 0) return null;

  return (
    <View style={styles.voterAvatarStrip} pointerEvents="none" focusable={false}>
      {voters.slice(0, 5).map((voter) => (
        voter.avatar ? (
          <AvatarPortrait
            key={voter.playerId}
            avatarId={voter.avatar}
            displayName={voter.nickname}
            size={32}
          />
        ) : (
          <View key={voter.playerId} style={styles.voterAvatarFallback} pointerEvents="none" focusable={false}>
            <HuddleText variant="caption" color="text">?</HuddleText>
          </View>
        )
      ))}
    </View>
  );
}

function FinishedStage({ model }: { readonly model: Extract<VotingTvModel, { kind: 'finished' }> }) {
  return (
    <View style={styles.finished} accessible accessibilityRole="text" accessibilityLabel={finishedAccessibilityLabel(model)}>
      <View style={styles.finishBoard} pointerEvents="none" focusable={false}>
        <View style={styles.vibeMark} pointerEvents="none" focusable={false}>
          <View style={[styles.vibeDot, styles.vibeDotCoral]} />
          <View style={[styles.vibeDot, styles.vibeDotButter]} />
          <View style={[styles.vibeDot, styles.vibeDotMint]} />
          <View style={[styles.vibeDot, styles.vibeDotSky]} />
        </View>
        <Badge label="ROOM RECAP" tone="ready" />
        <HuddleText variant="tvDisplay" color="text" align="center">That’s the room’s vibe</HuddleText>
        <HuddleText variant="bodyLarge" color="text" align="center">Here’s what the room shared—no scores or winners.</HuddleText>
        <View style={styles.recapList} pointerEvents="none" focusable={false} testID="voting-tv-recap">
          {model.recap.length === 0 ? (
            <View style={styles.recapCard} pointerEvents="none" focusable={false}><HuddleText variant="title" color="text">Thanks for voting together.</HuddleText></View>
          ) : model.recap.map((item) => (
            <View key={item.kind} style={styles.recapCard} pointerEvents="none" focusable={false} testID={`voting-recap-${item.kind}`}>
              <HuddleText variant="hero" style={styles.recapIcon} accessibilityElementsHidden>{votingRecapIcon(item.detail)}</HuddleText>
              <View style={styles.recapCopy} pointerEvents="none" focusable={false}>
                <HuddleText variant="caption" color="text" style={styles.kicker}>{item.title.toUpperCase()}</HuddleText>
                <HuddleText variant="title" color="text">{item.detail}</HuddleText>
              </View>
              <HuddleText variant="title" color="text" style={styles.recapValue}>{item.value}</HuddleText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function visibleVoterNames(option: VotingTallyOption): string {
  const names = option.voters.map(({ nickname }) => nickname);
  return names.length <= 5 ? names.join(', ') : `${names.slice(0, 5).join(', ')} +${names.length - 5} more`;
}

function votingOptionAccessibilityLabel(
  option: VotingTallyOption,
  showResults: boolean,
  showNames = false,
): string {
  const letter = String.fromCharCode(65 + option.optionIndex);
  const result = showResults
    ? `${option.percent ?? 0}%, ${option.count ?? 0} vote${option.count === 1 ? '' : 's'}`
    : 'Waiting for the room';
  const names = showNames ? visibleVoterNames(option) : '';
  return [
    `${letter}: ${option.text}`,
    result,
    names === '' ? null : `Voters: ${names}`,
  ].filter((part): part is string => part !== null).join('. ');
}

function voteAccessibilityLabel(model: Extract<VotingTvModel, { kind: 'vote' }>): string {
  const choices = model.options.map((option) => votingOptionAccessibilityLabel(option, model.live)).join('; ');
  const timer = model.countdownSeconds === undefined ? 'No visible timer' : `${model.countdownSeconds} seconds remaining`;
  return `Round ${model.roundIndex + 1} of ${model.roundCount}. Choose on your phone. ${model.text}. ${model.live ? 'Live tally.' : 'Reveal together.'} ${timer}. Choices: ${choices}. ${model.voted} of ${model.playerCount} voted. Votes stay private; only the room’s aggregate appears here.`;
}

function revealAccessibilityLabel(model: Extract<VotingTvModel, { kind: 'reveal' }>): string {
  const choices = model.options.map((option) => votingOptionAccessibilityLabel(option, true, model.labelsShown)).join('; ');
  return `Reveal for round ${model.roundIndex + 1} of ${model.roundCount}. The room has spoken. ${model.text}. ${model.labelsShown ? 'Names after reveal.' : 'Shared result.'} Choices: ${choices}. ${model.voted} of ${model.playerCount} voted. No scores. No winner. Just the room’s vibe.`;
}

function finishedAccessibilityLabel(model: Extract<VotingTvModel, { kind: 'finished' }>): string {
  const recap = model.recap.length === 0
    ? 'Thanks for voting together.'
    : model.recap.map((item) => `${item.title}: ${item.detail}. ${item.value}`).join('; ');
  return `That’s the room’s vibe. Voting recap. Here’s what the room shared—no scores or winners. ${recap}`;
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function useCountdownSeconds(clockRemainingMs: number | undefined, fallbackSeconds: number, beat: string): number {
  const startingMs = Math.max(0, Number.isFinite(clockRemainingMs) ? clockRemainingMs! : fallbackSeconds * 1000);
  const initial = Math.max(0, Math.ceil(startingMs / 1000));
  const [display, setDisplay] = useState({ beat, startingMs, seconds: initial });
  const seconds = display.beat === beat && display.startingMs === startingMs ? display.seconds : initial;

  useEffect(() => {
    if (startingMs <= 0) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const remaining = startingMs - (Date.now() - startedAt);
      if (remaining <= 0) {
        setDisplay({ beat, startingMs, seconds: 0 });
        clearInterval(timer);
        return;
      }
      setDisplay({ beat, startingMs, seconds: Math.ceil(remaining / 1000) });
    }, 250);
    return () => clearInterval(timer);
  }, [beat, startingMs]);

  return seconds;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: semanticColors.background },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden' },
  safeFrame: { flex: 1, paddingHorizontal: OVERSCAN_X, paddingVertical: OVERSCAN_Y, gap: spacing.sm },
  stageLabel: { letterSpacing: 2, opacity: 0.72, paddingLeft: spacing.xs },
  introStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['4xl'] },
  introBoard: { width: 1200, maxWidth: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['4xl'], paddingVertical: spacing['3xl'], borderRadius: 40, backgroundColor: 'rgba(249, 241, 230, 0.86)', borderColor: semanticColors.primary, borderWidth: 4, gap: spacing.lg, ...shadows.floating },
  legacyBoard: { flex: 1, width: 1120, maxWidth: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['4xl'], paddingVertical: spacing['3xl'], borderRadius: 40, backgroundColor: 'rgba(249, 241, 230, 0.9)', borderColor: semanticColors.primary, borderWidth: 4, gap: spacing.lg, ...shadows.floating },
  gameBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 20, height: 20, borderRadius: radii.round, backgroundColor: semanticColors.primary, borderColor: semanticColors.text, borderWidth: 3 },
  introSettings: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  content: { flex: 1, gap: spacing.lg },
  topRow: { minHeight: 112, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xl },
  headingCopy: { gap: spacing.xs },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kicker: { letterSpacing: 1.4, opacity: 0.72 },
  timerPill: { width: 132, height: 92, paddingHorizontal: spacing.lg, borderRadius: radii.xl, backgroundColor: semanticColors.text, borderColor: semanticColors.primary, borderWidth: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs, ...shadows.raised },
  promptPanel: { minHeight: 196, paddingHorizontal: spacing['3xl'], paddingVertical: spacing.xl, borderRadius: 36, backgroundColor: 'rgba(249, 241, 230, 0.88)', borderColor: semanticColors.primary, borderWidth: 4, alignItems: 'center', justifyContent: 'center', ...shadows.floating },
  optionRow: { flex: 1, flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  optionCard: { flex: 1, minWidth: 0, minHeight: 360, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, borderRadius: 28, backgroundColor: 'rgba(249, 241, 230, 0.94)', borderColor: 'rgba(43, 31, 23, 0.16)', borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: spacing.md, ...shadows.card },
  optionIcon: { fontSize: 58, lineHeight: 68 },
  tallyTrack: { width: '100%', height: 18, borderRadius: radii.round, overflow: 'hidden', backgroundColor: 'rgba(230, 163, 177, 0.44)' },
  tallyFill: { height: '100%', borderRadius: radii.round, backgroundColor: semanticColors.primary },
  voterLabels: { width: '100%', alignItems: 'center', gap: spacing.xs },
  voterAvatarStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  voterAvatarFallback: { width: 40, height: 40, borderRadius: radii.round, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.secondary },
  dimCopy: { opacity: 0.64 },
  participationRow: { minHeight: 72, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  participationCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flex: 1 },
  avatarStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  finished: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['4xl'] },
  finishBoard: { width: 1160, maxWidth: '100%', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.xl, borderRadius: 40, backgroundColor: 'rgba(249, 241, 230, 0.9)', borderColor: semanticColors.primary, borderWidth: 4, ...shadows.floating },
  vibeMark: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vibeDot: { width: 28, height: 28, borderRadius: 10, transform: [{ rotate: '45deg' }] },
  vibeDotCoral: { backgroundColor: semanticColors.primary },
  vibeDotButter: { backgroundColor: semanticColors.secondary },
  vibeDotMint: { backgroundColor: semanticColors.success },
  vibeDotSky: { backgroundColor: semanticColors.info },
  recapList: { width: '100%', gap: spacing.sm },
  recapCard: { minHeight: 96, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 22, backgroundColor: 'rgba(255, 111, 97, 0.12)', borderColor: 'rgba(255, 111, 97, 0.32)', borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, ...shadows.card },
  recapIcon: { width: 64, fontSize: 48, lineHeight: 58, textAlign: 'center' },
  recapCopy: { flex: 1, gap: spacing.xs },
  recapValue: { minWidth: 116, textAlign: 'right' },
});
