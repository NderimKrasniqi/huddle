import { brandColors, spacing } from '@huddle/design-tokens';
import type { PhoneGameScreenProps, PhoneSafeAreaInsets } from '@huddle/domain';
import {
  HEARTBEAT_ARTWORK,
  HuddleButton,
  HuddleIcon,
  HuddleText,
  ScreenShell,
} from '@huddle/ui/native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, ImageBackground, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

import { votingPhoneModel, type VotingChoice } from './controller';
import { votingOptionIcon } from './option-icon';
import { playableVotingState } from './state';
import { votingOptionTones, votingTvTheme } from './tv-theme';
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
        <HuddleText variant="display" align="center" accessibilityRole="header">Voting needs an update</HuddleText>
        <HuddleText variant="bodyLarge" align="center">Ask the Host to return to the room and start Voting again.</HuddleText>
      </VotingStatusPage>
    );
  }

  if (model.kind === 'intro') {
    return (
      <VotingStatusPage insets={insets} chromeInset={chromeInset} testID="voting-phone-intro">
        <VotingBrandHeader />
        <Image source={HEARTBEAT_ARTWORK.phone.votingRoomArt} style={styles.introArt} resizeMode="cover" accessible={false} />
        <HuddleText variant="display" align="center" style={styles.introTitle}>Get ready!</HuddleText>
        <HuddleText variant="bodyLarge" align="center" style={styles.introCopy}>Vote on fun prompts and see the room’s vibe.</HuddleText>
        <View style={styles.summaryPanel}>
          <SummaryRow icon="◷" label={`${model.rounds} rounds`} />
          <SummaryRow icon="⌛" label={model.voteSeconds === 'none' ? 'No visible timer' : `${model.voteSeconds} seconds to vote`} />
          <SummaryRow icon="▣" label={model.results === 'live' ? 'Live tally on the TV' : 'Reveal together'} />
        </View>
        <HuddleText variant="caption" align="center" style={styles.helper}>Round 1 of {model.rounds} begins soon…</HuddleText>
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
        <StatusBar barStyle="dark-content" backgroundColor={brandColors.cream} />
        <ImageBackground
          source={HEARTBEAT_ARTWORK.phone.votingClouds}
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

            <View style={styles.voteStack}>
              <View style={styles.roundPill}>
                <HuddleText variant="caption" style={styles.pillText}>Round {model.roundIndex + 1} of {model.roundCount}</HuddleText>
              </View>
              <HuddleText variant="title" align="center" accessibilityRole="header" style={styles.promptText}>
                {model.text}
              </HuddleText>
              <View
                style={[styles.timerPill, styles.voteTimerPill]}
                testID="voting-phone-clock"
                accessible
                accessibilityRole="text"
                accessibilityLabel={current?.voteSeconds === 'none' ? 'No timer' : `${countdown} seconds remaining`}
              >
                <HuddleIcon name="clock" size={18} color={brandColors.espresso} />
                <HuddleText variant="body" style={styles.timerText}>{current?.voteSeconds === 'none' ? 'NO TIMER' : `${countdown}s`}</HuddleText>
              </View>
              <HuddleText variant="caption" align="center" style={styles.votePrivacyNote}>
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

              <View style={[styles.lockNote, styles.openLockNote]} accessibilityLiveRegion="polite">
                <HuddleText variant="body" style={styles.lockIcon} accessibilityElementsHidden>🔒</HuddleText>
                <HuddleText variant="body" align="center">
                  {model.locked ? 'Vote locked' : 'Choose once'}
                </HuddleText>
                <HuddleText variant="caption" align="center" style={styles.helper}>
                  {model.locked ? 'Hang tight—everyone is casting their vote.' : 'Your first choice locks for this round.'}
                </HuddleText>
              </View>
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
        <HuddleText variant="display" align="center" accessibilityRole="header">That’s the room’s vibe</HuddleText>
        <Image source={HEARTBEAT_ARTWORK.phone.votingRoomArt} style={styles.statusArt} resizeMode="cover" accessible={false} />
        <HuddleText variant="bodyLarge" align="center">The shared recap is on the TV.</HuddleText>
        <View style={styles.recapPanel}>
          <HuddleText variant="body" align="center">📺&nbsp; Recap is on the TV</HuddleText>
        </View>
        <HuddleText variant="body" align="center">Thanks for voting!</HuddleText>
        <HuddleText variant="caption" align="center" style={styles.helper}>Waiting for the Host…</HuddleText>
      </VotingStatusPage>
    );
  }

  return (
    <VotingStatusPage insets={insets} chromeInset={chromeInset} testID={`voting-phone-${model.kind}`}>
      <VotingBrandHeader />
      {model.kind === 'eyesUp' ? (
        <View style={styles.roundPill}>
          <HuddleText variant="caption" style={styles.pillText}>Round {model.roundIndex + 1} of {model.roundCount}</HuddleText>
        </View>
      ) : null}
      <HuddleText variant="display" align="center" accessibilityRole="header">Eyes up!</HuddleText>
      <Image source={HEARTBEAT_ARTWORK.phone.votingRoomArt} style={styles.statusArt} resizeMode="cover" accessible={false} />
      <View style={styles.recapPanel}>
        <HuddleText variant="body" align="center">📺&nbsp; The room’s vote is on the TV</HuddleText>
      </View>
      <HuddleText variant="body" align="center">Enjoy the reveal together!</HuddleText>
    </VotingStatusPage>
  );
}

function VotingBrandHeader() {
  return (
    <View style={styles.brandHeader} accessibilityRole="header">
      <View style={styles.gameMark} accessible accessibilityLabel="Voting">
        <View style={styles.heartMarkLobe} />
        <View style={[styles.heartMarkLobe, styles.heartMarkRight]} />
        <View style={styles.heartMarkPoint} />
      </View>
      <HuddleText variant="title" style={styles.brandTitle}>VOTING</HuddleText>
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
      <StatusBar barStyle="dark-content" backgroundColor={brandColors.cream} />
      <ImageBackground
        source={HEARTBEAT_ARTWORK.phone.votingClouds}
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
            source={HEARTBEAT_ARTWORK.phone.votingRoomArt}
            resizeMode="cover"
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
        { backgroundColor: votingOptionTones[choice.optionIndex % votingOptionTones.length] },
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
      <StatusBar barStyle="dark-content" backgroundColor={brandColors.cream} />
      <ImageBackground
        source={HEARTBEAT_ARTWORK.phone.votingClouds}
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
    opacity: 0.08,
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
  gameMark: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  heartMarkLobe: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: votingTvTheme.coral,
  },
  heartMarkRight: {
    left: 10,
  },
  heartMarkPoint: {
    position: 'absolute',
    left: 6,
    bottom: 2,
    width: 17,
    height: 17,
    backgroundColor: votingTvTheme.coral,
    transform: [{ rotate: '45deg' }],
  },
  brandTitle: {
    letterSpacing: -0.4,
    color: votingTvTheme.plum,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  voteStack: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  roundPill: {
    minHeight: 38,
    flex: 1,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: votingTvTheme.plum,
    backgroundColor: votingTvTheme.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: votingTvTheme.plum,
    letterSpacing: 0.5,
  },
  timerPill: {
    minWidth: 76,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: votingTvTheme.plum,
    backgroundColor: votingTvTheme.coral,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    shadowColor: votingTvTheme.paperShadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  voteTimerPill: {
    minWidth: 76,
    backgroundColor: votingTvTheme.coral,
    borderColor: votingTvTheme.plum,
    justifyContent: 'center',
  },
  timerIcon: {
    fontSize: 14,
  },
  timerText: {
    fontWeight: '700',
    color: votingTvTheme.plum,
  },
  promptText: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    color: votingTvTheme.plum,
  },
  choices: {
    width: '100%',
    gap: spacing.sm,
  },
  choiceButton: {
    width: '100%',
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: votingTvTheme.plum,
    backgroundColor: votingTvTheme.cream,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    opacity: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  choiceSelected: {
    backgroundColor: votingTvTheme.cream,
    borderColor: votingTvTheme.plum,
    borderWidth: 3,
    opacity: 1,
  },
  choiceClosed: {
    opacity: 0.5,
  },
  choiceIcon: { width: 42, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  choiceLabel: {
    flex: 1,
    textAlign: 'left',
    color: votingTvTheme.plum,
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
  votePrivacyNote: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  openLockNote: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    minHeight: 0,
    padding: 0,
  },
  lockIcon: {
    fontSize: 16,
  },
  helper: {
    opacity: 0.68,
  },
  statusScroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  statusContent: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusArt: {
    width: 204,
    height: 164,
  },
  waitingPanel: {
    width: '100%',
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 7,
    borderWidth: 2,
    borderTopWidth: 6,
    borderColor: votingTvTheme.plum,
    backgroundColor: votingTvTheme.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    shadowColor: votingTvTheme.paperShadow,
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  waitingArt: {
    width: 204,
    height: 164,
  },
  introArt: {
    width: 208,
    height: 156,
    marginTop: spacing.xs,
  },
  introTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: votingTvTheme.coral,
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
    borderRadius: 7,
    borderWidth: 2,
    borderColor: votingTvTheme.plum,
    backgroundColor: votingTvTheme.cream,
    shadowColor: votingTvTheme.paperShadow,
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  recapPanel: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: votingTvTheme.plum,
    backgroundColor: votingTvTheme.blush,
    alignItems: 'center',
  },
  summaryRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: votingTvTheme.rule,
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
