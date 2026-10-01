import type { TvGameScreenProps } from '@huddle/domain';
import { AvatarPortrait, HuddleText } from '@huddle/ui/game-kit';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';

import { INTRO_SECONDS, playableVotingState } from './state';
import { votingOptionIcon, votingRecapIcon } from './option-icon';
import { votingOptionTones, votingTvTheme } from './tv-theme';
import type { VotingState } from './types';
import { votingTvModel, type VotingTallyOption, type VotingTvModel } from './watching';
import { votingSpacing } from './theme';
import { VOTING_ART } from './art';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const OVERSCAN_X = 96;
const OVERSCAN_Y = 54;

/** Shared Voting stage. It is a pure, non-focusable presentation surface. */
export function VotingTvScreen({ state, players, clockRemainingMs }: TvGameScreenProps<VotingState>) {
  const viewport = useWindowDimensions();
  const current = playableVotingState(state);
  const introCountdown = useCountdownSeconds(
    current?.phase === 'intro' ? clockRemainingMs : undefined,
    current?.phase === 'intro' ? INTRO_SECONDS : 0,
    current === undefined ? 'legacy-intro' : `${current.roundIndex}:intro`,
  );
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
        <ImageBackground source={VOTING_ART.world} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} testID="voting-tv-world" />
        <View style={styles.worldWash} pointerEvents="none" focusable={false} />
        <View style={styles.safeFrame} pointerEvents="none" focusable={false}>
          <View style={styles.stageLabel} pointerEvents="none" focusable={false} accessibilityElementsHidden>
            <View style={styles.stageLabelHeart} />
            <HuddleText variant="caption" color="text" style={styles.stageLabelCopy}>VOTING · ROOM MOOD</HuddleText>
          </View>
          {model.kind === 'legacy' ? <LegacyStage rounds={model.rounds} /> : null}
          {model.kind === 'intro' ? <IntroStage players={players} countdownSeconds={introCountdown} /> : null}
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
      <VotingTag label="VOTING" tone="muted" />
      <HuddleText variant="tvDisplay" color="text" align="center">Room needs an update</HuddleText>
      <HuddleText variant="bodyLarge" color="text" align="center">This earlier room was set for {rounds} rounds. Return to the room to start again.</HuddleText>
    </View>
  );
}

function IntroStage({
  players,
  countdownSeconds,
}: {
  readonly players: TvGameScreenProps<VotingState>['players'];
  readonly countdownSeconds: number;
}) {
  return (
      <View style={styles.introStage} accessible accessibilityRole="text" accessibilityLabel={`Voting countdown. Get ready to vote. ${countdownSeconds} seconds remaining. Choices happen privately on the phones.`}>
      <View style={styles.introHeart} pointerEvents="none" focusable={false}><View style={styles.heartLobe} /><View style={[styles.heartLobe, styles.heartLobeRight]} /><View style={styles.heartPoint} /></View>
      <View style={styles.introBoard} pointerEvents="none" focusable={false}>
        <View style={styles.gameBrand} pointerEvents="none" focusable={false}>
          <View style={styles.brandMark} />
          <HuddleText variant="caption" color="text" style={styles.brandLabel}>VOTING / ROOM MOOD</HuddleText>
        </View>
        <HuddleText variant="tvDisplay" color="text" align="center">Get ready to vote!</HuddleText>
        <View style={styles.countdownMark} pointerEvents="none" focusable={false}>
          <HuddleText variant="caption" color="text" align="center" style={styles.countdownLabel}>STARTING IN</HuddleText>
          <HuddleText variant="hero" color="text" align="center" style={styles.countdownNumber}>{countdownSeconds}</HuddleText>
        </View>
        <HuddleText variant="bodyLarge" color="text" align="center" style={styles.dimCopy}>Choices happen privately on the phones.</HuddleText>
      </View>
      <View style={styles.playerRibbon} pointerEvents="none" focusable={false}>
        <HuddleText variant="caption" color="text" style={styles.ribbonLabel}>IN THE ROOM</HuddleText>
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
          <HuddleText variant="caption" color="text" style={styles.kicker}>ROUND {model.roundIndex + 1} / {model.roundCount}</HuddleText>
          <HuddleText variant="title" color="text">Make your mark</HuddleText>
        </View>
        <View style={styles.topMeta}>
          {model.live ? <VotingTag label="LIVE TALLY" tone="live" /> : <VotingTag label="REVEAL TOGETHER" tone="muted" />}
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
          <VotingTag label={`${model.voted}/${model.playerCount} voted`} tone={model.voted === model.playerCount ? 'ready' : 'paper'} />
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
        <VotingTag label={model.labelsShown ? 'NAMES AFTER REVEAL' : 'SHARED RESULT'} tone="ready" />
      </View>
      <View style={styles.promptPanel} pointerEvents="none" focusable={false}><HuddleText variant="display" color="text" align="center">{model.text}</HuddleText></View>
      <View style={styles.optionRow} pointerEvents="none" focusable={false} testID="voting-tv-reveal-grid">
        {model.options.map((option) => <OptionCard key={option.optionIndex} option={option} showResults showNames={model.labelsShown} />)}
      </View>
      <View style={styles.participationRow} pointerEvents="none" focusable={false}>
        <VotingTag label={`${model.voted}/${model.playerCount} voted`} tone="ready" />
        <HuddleText variant="bodyLarge" color="text">No scores. No winner. Just the room’s vibe.</HuddleText>
      </View>
    </View>
  );
}

function OptionCard({ option, showResults, showNames = false }: { readonly option: VotingTallyOption; readonly showResults: boolean; readonly showNames?: boolean }) {
  const visibleNames = visibleVoterNames(option);
  return (
    <View style={[styles.optionCard, { backgroundColor: votingOptionTones[option.optionIndex % votingOptionTones.length] }]} pointerEvents="none" focusable={false} testID={`voting-tv-option-${option.optionIndex}`}>
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

function VotingTag({ label, tone }: { readonly label: string; readonly tone: 'muted' | 'paper' | 'ready' | 'live' }) {
  return (
    <View style={[styles.tag, tone === 'ready' ? styles.readyTag : tone === 'live' ? styles.liveTag : tone === 'muted' ? styles.mutedTag : styles.paperTag]} pointerEvents="none" focusable={false}>
      <HuddleText variant="caption" color="text" style={styles.tagCopy}>{label}</HuddleText>
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
        <VotingTag label="ROOM RECAP" tone="ready" />
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
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: votingTvTheme.blush },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden' },
  worldWash: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 240, 222, 0.08)' },
  safeFrame: { flex: 1, paddingHorizontal: OVERSCAN_X, paddingVertical: OVERSCAN_Y, gap: votingSpacing.sm },
  stageLabel: { flexDirection: 'row', alignItems: 'center', gap: votingSpacing.xs, alignSelf: 'flex-start', paddingHorizontal: votingSpacing.sm, paddingVertical: votingSpacing.xs, backgroundColor: 'rgba(255, 240, 222, 0.78)', borderBottomWidth: 2, borderBottomColor: votingTvTheme.plum },
  stageLabelHeart: { width: 15, height: 15, backgroundColor: votingTvTheme.coral, transform: [{ rotate: '45deg' }], borderRadius: 3 },
  stageLabelCopy: { color: votingTvTheme.plum, letterSpacing: 2 },
  introStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: votingSpacing['4xl'] },
  introHeart: { position: 'absolute', left: 370, top: 152, width: 120, height: 120, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  heartLobe: { position: 'absolute', width: 54, height: 76, borderRadius: 42, backgroundColor: votingTvTheme.coral, transform: [{ rotate: '-42deg' }, { translateX: -18 }, { translateY: -18 }] },
  heartLobeRight: { transform: [{ rotate: '42deg' }, { translateX: 18 }, { translateY: -18 }] },
  heartPoint: { position: 'absolute', width: 72, height: 72, backgroundColor: votingTvTheme.coral, transform: [{ rotate: '45deg' }, { translateY: 20 }], borderRadius: 6 },
  introBoard: { width: 930, maxWidth: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: votingSpacing['4xl'], paddingVertical: votingSpacing['3xl'], borderRadius: 10, backgroundColor: 'rgba(255, 240, 222, 0.94)', borderColor: votingTvTheme.plum, borderWidth: 2, borderTopWidth: 9, gap: votingSpacing.lg, shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.44, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  playerRibbon: { position: 'absolute', bottom: 70, flexDirection: 'row', alignItems: 'center', gap: votingSpacing.lg, paddingHorizontal: votingSpacing.lg, paddingVertical: votingSpacing.sm, borderBottomWidth: 2, borderBottomColor: votingTvTheme.plum },
  ribbonLabel: { color: votingTvTheme.plum, letterSpacing: 1.8 },
  legacyBoard: { flex: 1, width: 1120, maxWidth: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: votingSpacing['4xl'], paddingVertical: votingSpacing['3xl'], borderRadius: 10, backgroundColor: 'rgba(255, 240, 222, 0.94)', borderColor: votingTvTheme.coral, borderWidth: 2, borderTopWidth: 9, gap: votingSpacing.lg, shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  gameBrand: { flexDirection: 'row', alignItems: 'center', gap: votingSpacing.sm },
  brandMark: { width: 20, height: 20, borderRadius: 3, backgroundColor: votingTvTheme.coral, borderColor: votingTvTheme.plum, borderWidth: 2, transform: [{ rotate: '45deg' }] },
  brandLabel: { color: votingTvTheme.plum, letterSpacing: 2.1 },
  countdownLabel: { marginTop: votingSpacing.sm, letterSpacing: 3, color: votingTvTheme.plumSoft },
  countdownMark: { minWidth: 320, alignItems: 'center', paddingVertical: votingSpacing.sm, borderTopWidth: 2, borderBottomWidth: 2, borderColor: votingTvTheme.rule },
  countdownNumber: { marginTop: -votingSpacing.sm, fontSize: 168, lineHeight: 184, color: votingTvTheme.coralDark },
  content: { flex: 1, gap: votingSpacing.lg },
  topRow: { minHeight: 112, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: votingSpacing.xl },
  headingCopy: { gap: votingSpacing.xs },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: votingSpacing.md },
  kicker: { letterSpacing: 1.4, color: votingTvTheme.plumSoft },
  timerPill: { width: 132, height: 92, paddingHorizontal: votingSpacing.lg, borderRadius: 8, backgroundColor: votingTvTheme.plum, borderColor: votingTvTheme.coral, borderWidth: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: votingSpacing.xs, shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  promptPanel: { minHeight: 196, paddingHorizontal: votingSpacing['3xl'], paddingVertical: votingSpacing.xl, borderRadius: 8, backgroundColor: 'rgba(255, 240, 222, 0.94)', borderColor: votingTvTheme.plum, borderWidth: 2, borderLeftWidth: 10, alignItems: 'center', justifyContent: 'center', shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.38, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  optionRow: { flex: 1, flexDirection: 'row', gap: votingSpacing.md, alignItems: 'stretch' },
  optionCard: { flex: 1, minWidth: 0, minHeight: 360, paddingHorizontal: votingSpacing.lg, paddingVertical: votingSpacing.xl, borderRadius: 7, borderColor: votingTvTheme.plum, borderWidth: 2, borderBottomWidth: 9, alignItems: 'center', justifyContent: 'center', gap: votingSpacing.md, shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  optionIcon: { fontSize: 58, lineHeight: 68, color: votingTvTheme.plum },
  tallyTrack: { width: '100%', height: 18, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(99, 63, 85, 0.18)' },
  tallyFill: { height: '100%', borderRadius: 3, backgroundColor: votingTvTheme.coralDark },
  voterLabels: { width: '100%', alignItems: 'center', gap: votingSpacing.xs },
  voterAvatarStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: votingSpacing.xs },
  voterAvatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: votingTvTheme.butter },
  dimCopy: { color: votingTvTheme.plumSoft },
  participationRow: { minHeight: 72, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: votingSpacing.lg },
  participationCopy: { flexDirection: 'row', alignItems: 'center', gap: votingSpacing.lg, flex: 1 },
  avatarStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: votingSpacing.sm },
  finished: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: votingSpacing['4xl'] },
  finishBoard: { width: 1160, maxWidth: '100%', alignItems: 'center', justifyContent: 'center', gap: votingSpacing.md, paddingHorizontal: votingSpacing['2xl'], paddingVertical: votingSpacing.xl, borderRadius: 9, backgroundColor: 'rgba(255, 240, 222, 0.95)', borderColor: votingTvTheme.plum, borderWidth: 2, borderTopWidth: 9, shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.42, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  vibeMark: { flexDirection: 'row', alignItems: 'center', gap: votingSpacing.sm },
  vibeDot: { width: 28, height: 28, borderRadius: 4, transform: [{ rotate: '45deg' }] },
  vibeDotCoral: { backgroundColor: votingTvTheme.coral },
  vibeDotButter: { backgroundColor: votingTvTheme.butter },
  vibeDotMint: { backgroundColor: votingTvTheme.mint },
  vibeDotSky: { backgroundColor: votingTvTheme.sky },
  recapList: { width: '100%', gap: votingSpacing.sm },
  recapCard: { minHeight: 96, paddingHorizontal: votingSpacing.lg, paddingVertical: votingSpacing.md, borderRadius: 6, backgroundColor: 'rgba(247, 207, 194, 0.62)', borderColor: votingTvTheme.plum, borderWidth: 2, borderLeftWidth: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: votingSpacing.lg, shadowColor: votingTvTheme.paperShadow, shadowOpacity: 0.22, shadowRadius: 7, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  recapIcon: { width: 64, fontSize: 48, lineHeight: 58, textAlign: 'center', color: votingTvTheme.plum },
  recapCopy: { flex: 1, gap: votingSpacing.xs },
  recapValue: { minWidth: 116, textAlign: 'right' },
  tag: { paddingHorizontal: votingSpacing.md, paddingVertical: votingSpacing.xs, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tagCopy: { color: votingTvTheme.plum, letterSpacing: 1.1 },
  paperTag: { backgroundColor: votingTvTheme.cream, borderColor: votingTvTheme.plum },
  readyTag: { backgroundColor: votingTvTheme.mint, borderColor: votingTvTheme.plum },
  mutedTag: { backgroundColor: votingTvTheme.blush, borderColor: votingTvTheme.plum },
  liveTag: { backgroundColor: votingTvTheme.coral, borderColor: votingTvTheme.plum },
});
