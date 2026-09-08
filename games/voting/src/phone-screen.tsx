import { brandColors, radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import type { PhoneGameScreenProps, PhoneSafeAreaInsets } from '@huddle/domain';
import {
  HEARTBEAT_ARTWORK,
  HuddleButton,
  HuddleText,
  ScreenShell,
} from '@huddle/ui/native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, ImageBackground, ScrollView, StyleSheet, View } from 'react-native';

import { votingPhoneModel, type VotingChoice } from './controller';
import { votingOptionIcon } from './option-icon';
import { playableVotingState } from './state';
import type { VotingEvent, VotingState } from './types';

const ZERO_INSETS: PhoneSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Private Voting controller. A choice is visible and actionable only on its owner Phone. */
export function VotingPhoneScreen({
  state,
  player,
  sendEvent,
  safeAreaInsets,
  hostChromeInsetTop,
  clockRemainingMs,
}: PhoneGameScreenProps<VotingState, VotingEvent>) {
  const insets = safeAreaInsets ?? ZERO_INSETS;
  const chromeInset = finiteInset(hostChromeInsetTop);
  const current = playableVotingState(state);
  const model = votingPhoneModel(state, player.playerId);
  const countdown = useCountdownSeconds(
    current?.phase === 'vote' && current.voteSeconds !== 'none' ? clockRemainingMs : undefined,
    current?.phase === 'vote' && current.voteSeconds !== 'none' ? current.voteSeconds : 0,
    current === undefined ? 'legacy' : `${current.roundIndex}:${current.phase}`,
  );

  if (model.kind === 'legacy') {
    return (
      <VotingStatusPage insets={insets} chromeInset={chromeInset} testID="voting-phone-legacy">
        <VotingBrandHeader />
        <Image
          source={HEARTBEAT_ARTWORK.gameCards.voting}
          style={styles.statusArt}
          resizeMode="contain"
          accessible={false}
        />
        <HuddleText variant="display" align="center" accessibilityRole="header">Voting needs an update</HuddleText>
        <HuddleText variant="bodyLarge" align="center">Ask the Host to return to the room and start Voting again.</HuddleText>
      </VotingStatusPage>
    );
  }

  if (model.kind === 'intro') {
    return (
      <VotingStatusPage insets={insets} chromeInset={chromeInset} testID="voting-phone-intro">
        <VotingBrandHeader />
        <Image source={HEARTBEAT_ARTWORK.gameCards.voting} style={styles.introArt} resizeMode="contain" accessible={false} />
        <HuddleText variant="display" align="center" style={styles.introTitle}>Get ready!</HuddleText>
        <HuddleText variant="bodyLarge" align="center" style={styles.introCopy}>Vote on fun prompts and see the room’s vibe.</HuddleText>
        <View style={styles.summaryPanel}>
          <SummaryRow icon="◷" label={`${model.rounds} rounds`} />
          <SummaryRow icon="⌛" label={model.voteSeconds === 'none' ? 'No visible timer' : `${model.voteSeconds} seconds to vote`} />
          <SummaryRow icon="▣" label={model.results === 'live' ? 'Live tally on the TV' : 'Reveal together'} />
        </View>
      </VotingStatusPage>
    );
  }

  if (model.kind === 'vote' && model.locked) {
    return (
      <VotingWaitingSurface
        roundIndex={model.roundIndex}
        roundCount={model.roundCount}
        prompt={model.text}
        participationCount={current?.participationCount}
        playerCount={current?.playerIds.length ?? 0}
        insets={insets}
        chromeInset={chromeInset}
      />
    );
  }

  if (model.kind === 'vote') {
    return (
      <ScreenShell tone="background" style={styles.shell} testID="voting-phone-screen">
        <ImageBackground
          source={HEARTBEAT_ARTWORK.gameWorlds.voting}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="voting-phone-world"
        />
        <View style={styles.worldWash} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + chromeInset + spacing.lg,
              paddingRight: insets.right + spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              paddingLeft: insets.left + spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          testID="voting-phone-scroll"
        >
          <View style={styles.page}>
            <VotingBrandHeader />

            <View style={styles.roundRow}>
              <View style={styles.roundPill}>
                <HuddleText variant="caption" style={styles.pillText}>Round {model.roundIndex + 1} of {model.roundCount}</HuddleText>
              </View>
              <View
                style={styles.timerPill}
                testID="voting-phone-clock"
                accessible
                accessibilityRole="text"
                accessibilityLabel={current?.voteSeconds === 'none' ? 'No timer' : `${countdown} seconds remaining`}
              >
                <HuddleText variant="caption" style={styles.timerIcon} accessibilityElementsHidden>⌛</HuddleText>
                <HuddleText variant="body" style={styles.timerText}>{current?.voteSeconds === 'none' ? 'NO TIMER' : `${countdown}s`}</HuddleText>
              </View>
            </View>

            <HuddleText variant="title" align="center" accessibilityRole="header" style={styles.promptText}>
              {model.text}
            </HuddleText>
            <HuddleText variant="caption" align="center" style={styles.helper}>
              Your vote stays private on this phone until the shared reveal.
            </HuddleText>

            <View style={styles.choices}>
              {model.choices.map((choice) => (
                <VotingChoiceButton
                  key={choice.optionIndex}
                  choice={choice}
                  onPress={() => sendEvent({
                    kind: 'vote',
                    playerId: player.playerId,
                    roundIndex: model.roundIndex,
                    optionIndex: choice.optionIndex,
                  })}
                />
              ))}
            </View>

            <View style={styles.lockNote} accessibilityLiveRegion="polite">
              <HuddleText variant="body" style={styles.lockIcon} accessibilityElementsHidden>🔒</HuddleText>
              <HuddleText variant="body" align="center">
                {model.locked ? 'Vote locked' : 'Choose once'}
              </HuddleText>
              <HuddleText variant="caption" align="center" style={styles.helper}>
                {model.locked ? 'Hang tight—everyone is casting their vote.' : 'Your first choice locks for this round.'}
              </HuddleText>
            </View>
          </View>
        </ScrollView>
      </ScreenShell>
    );
  }

  if (model.kind === 'finished') {
    return (
      <VotingStatusPage insets={insets} chromeInset={chromeInset} testID="voting-phone-finished">
        <VotingBrandHeader />
        <Image source={HEARTBEAT_ARTWORK.gameCards.voting} style={styles.statusArt} resizeMode="contain" accessible={false} />
        <HuddleText variant="display" align="center" accessibilityRole="header">That’s the room’s vibe</HuddleText>
        <HuddleText variant="bodyLarge" align="center">The shared recap is on the TV.</HuddleText>
      </VotingStatusPage>
    );
  }

  return (
    <VotingStatusPage insets={insets} chromeInset={chromeInset} testID={`voting-phone-${model.kind}`}>
      <VotingBrandHeader />
      <Image source={HEARTBEAT_ARTWORK.gameCards.voting} style={styles.statusArt} resizeMode="contain" accessible={false} />
      <HuddleText variant="display" align="center" accessibilityRole="header">Eyes up!</HuddleText>
      <HuddleText variant="bodyLarge" align="center">
        {model.kind === 'eyesUp' ? 'The room’s vote is on the TV.' : 'You’re in from the next game—enjoy the room’s vote.'}
      </HuddleText>
    </VotingStatusPage>
  );
}

function VotingBrandHeader() {
  return (
    <View style={styles.brandHeader} accessibilityRole="header">
      <Image
        source={HEARTBEAT_ARTWORK.brand.displayMark}
        resizeMode="contain"
        style={styles.brandMark}
        accessible
        accessibilityLabel="Huddle"
      />
      <HuddleText variant="title" style={styles.brandTitle}>Voting</HuddleText>
    </View>
  );
}

function VotingWaitingSurface({
  roundIndex,
  roundCount,
  prompt,
  participationCount,
  playerCount,
  insets,
  chromeInset,
}: {
  readonly roundIndex: number;
  readonly roundCount: number;
  readonly prompt: string;
  readonly participationCount?: number;
  readonly playerCount: number;
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeInset: number;
}) {
  const hasSafeParticipation = Number.isFinite(participationCount)
    && playerCount > 0;
  const voted = hasSafeParticipation
    ? Math.min(playerCount, Math.max(0, Math.round(participationCount ?? 0)))
    : undefined;

  return (
    <ScreenShell
      tone="background"
      style={[styles.shell, styles.statusPage]}
      testID="voting-phone-waiting"
    >
      <ImageBackground
        source={HEARTBEAT_ARTWORK.gameWorlds.voting}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="voting-phone-waiting-world"
      />
      <View style={styles.worldWash} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.statusScroll,
          {
            paddingTop: insets.top + chromeInset + spacing.xl,
            paddingRight: insets.right + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="voting-phone-waiting-scroll"
      >
        <View style={styles.statusContent} testID="voting-phone-waiting-after-vote">
          <VotingBrandHeader />
          <View style={styles.roundPill}>
            <HuddleText variant="caption" style={styles.pillText}>
              Round {roundIndex + 1} of {roundCount}
            </HuddleText>
          </View>
          <HuddleText variant="title" align="center" accessibilityRole="header">
            {prompt}
          </HuddleText>
          <View style={styles.waitingPanel} accessible accessibilityLiveRegion="polite">
            <HuddleText variant="title" align="center">
              {voted === undefined ? 'Waiting for others' : `${voted} of ${playerCount} voted`}
            </HuddleText>
            <HuddleText variant="body" align="center" style={styles.helper}>
              {voted === undefined ? 'Your vote is locked.' : 'Hang tight! Everyone’s casting their vote.'}
            </HuddleText>
          </View>
          <Image
            source={HEARTBEAT_ARTWORK.gameCards.voting}
            resizeMode="contain"
            style={styles.waitingArt}
            accessible={false}
          />
          <HuddleText variant="body" align="center" style={styles.helper}>
            The shared reveal is on the TV.
          </HuddleText>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function SummaryRow({ icon, label }: { readonly icon: string; readonly label: string }) {
  return (
    <View style={styles.summaryRow}>
      <HuddleText variant="body" style={styles.summaryIcon} accessibilityElementsHidden>{icon}</HuddleText>
      <HuddleText variant="body" style={styles.summaryLabel}>{label}</HuddleText>
    </View>
  );
}

function VotingChoiceButton({ choice, onPress }: { readonly choice: VotingChoice; readonly onPress: () => void }) {
  const isSelected = choice.state === 'locked';
  const isClosed = choice.state === 'closed';
  return (
    <HuddleButton
      variant="secondary"
      disabled={choice.state !== 'open'}
      onPress={onPress}
      accessibilityLabel={`${choice.text}${isSelected ? ', vote locked' : ''}`}
      accessibilityHint={choice.state === 'open' ? 'Locks this vote for the current round.' : 'This vote is locked.'}
      testID={`voting-choice-${choice.optionIndex}`}
      style={[
        styles.choiceButton,
        isSelected ? styles.choiceSelected : null,
        isClosed ? styles.choiceClosed : null,
      ]}
    >
      <HuddleText variant="title" style={styles.choiceIcon} accessibilityElementsHidden>
        {votingOptionIcon(choice.text)}
      </HuddleText>
      <HuddleText variant="body" style={styles.choiceLabel}>{choice.text}</HuddleText>
      {isSelected ? <HuddleText variant="body" style={styles.choiceLock} accessibilityElementsHidden>🔒</HuddleText> : null}
    </HuddleButton>
  );
}

function VotingStatusPage({
  children,
  insets,
  chromeInset,
  testID,
}: {
  readonly children: ReactNode;
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeInset: number;
  readonly testID: string;
}) {
  return (
    <ScreenShell tone="background" style={[styles.shell, styles.statusPage]} testID={testID}>
      <ImageBackground
        source={HEARTBEAT_ARTWORK.gameWorlds.voting}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID={`${testID}-world`}
      />
      <View style={styles.worldWash} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.statusScroll,
          {
            paddingTop: insets.top + chromeInset + spacing.xl,
            paddingRight: insets.right + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID={`${testID}-scroll`}
      >
        <View style={styles.statusContent}>{children}</View>
      </ScrollView>
    </ScreenShell>
  );
}

function finiteInset(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

function useCountdownSeconds(
  clockRemainingMs: number | undefined,
  fallbackSeconds: number,
  beat: string,
): number {
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
  shell: {
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  statusPage: {
    backgroundColor: brandColors.cream,
  },
  worldWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: brandColors.cream,
    opacity: 0.46,
  },
  scroll: {
    flexGrow: 1,
  },
  page: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing.md,
  },
  brandHeader: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 25,
    height: 24,
  },
  brandTitle: {
    letterSpacing: -0.4,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  roundPill: {
    minHeight: 34,
    flex: 1,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,111,97,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: semanticColors.textOnBrand,
  },
  timerPill: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.1)',
    backgroundColor: 'rgba(249,241,230,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    ...shadows.card,
  },
  timerIcon: {
    fontSize: 14,
  },
  timerText: {
    fontWeight: '700',
  },
  promptText: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  choices: {
    gap: spacing.sm,
  },
  choiceButton: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderColor: 'rgba(43,31,23,0.12)',
    backgroundColor: brandColors.cream,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    opacity: 1,
    ...shadows.card,
  },
  choiceSelected: {
    backgroundColor: semanticColors.accent,
    borderColor: semanticColors.accent,
    opacity: 1,
  },
  choiceClosed: {
    opacity: 0.5,
  },
  choiceIcon: { width: 42, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  choiceLabel: {
    flex: 1,
    textAlign: 'left',
  },
  choiceLock: {
    fontSize: 16,
  },
  lockNote: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lockIcon: {
    fontSize: 16,
  },
  helper: {
    opacity: 0.68,
  },
  statusScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  statusContent: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusArt: {
    width: 212,
    height: 208,
  },
  waitingPanel: {
    width: '100%',
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.1)',
    backgroundColor: 'rgba(249,241,230,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  waitingArt: {
    width: 208,
    height: 190,
  },
  introArt: {
    width: 222,
    height: 218,
    marginTop: spacing.sm,
  },
  introTitle: {
    fontSize: 34,
    lineHeight: 40,
  },
  introCopy: {
    maxWidth: 320,
  },
  summaryPanel: {
    width: '100%',
    maxWidth: 340,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.1)',
    backgroundColor: 'rgba(249,241,230,0.88)',
    ...shadows.card,
  },
  summaryRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(43,31,23,0.08)',
  },
  summaryIcon: {
    width: 24,
    textAlign: 'center',
    fontSize: 17,
  },
  summaryLabel: {
    flex: 1,
  },
});
