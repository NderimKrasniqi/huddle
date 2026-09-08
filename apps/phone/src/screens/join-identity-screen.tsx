import { api } from '@huddle/convex';
import {
  AVATAR_IDS,
  NICKNAME_MAX_LENGTH,
  type AvatarId,
  type GuestProfileV1,
  normalizeRoomCode,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_LENGTH,
} from '@huddle/domain';
import { brandColors, radii, spacing, typography } from '@huddle/design-tokens';
import {
  AvatarPortrait,
  HuddleButton,
  HuddleText,
  HEARTBEAT_ARTWORK,
  LoadingMark,
  ScreenShell,
} from '@huddle/ui/native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { joinFailureMessage } from '../features/join/join-rejection';
import { rememberProfile as persistProfile, loadGuestProfile } from '../features/join/identity';
import { codeEntry, nicknameEntry } from '../features/join/join-entry';
import { hostControlFailureMessage } from '../features/room';
import { phoneSessionTokenStore } from '../platform/session/native';
import { joinScreenState, rememberSession, usePhoneSession } from '../platform/session';
import { phoneIdentityStore } from '../platform/storage/native';
import { usePhoneReducedMotion } from '../ui/reduced-motion';

function normalizedCode(value: string): string {
  const normalized = [...normalizeRoomCode(value)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');
  return codeEntry(normalized);
}

type IdentityStateSurfaceProps = {
  readonly title: string;
  readonly message: string;
  readonly testID: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly loading?: boolean;
};

/** Open, reference-aligned state surface for deep-link and restoration guards. */
function IdentityStateSurface({ title, message, testID, action, loading = false }: IdentityStateSurfaceProps) {
  return (
    <ScreenShell tone="background" style={styles.stateRoot} testID={testID}>
      {loading ? (
        <LoadingMark size={104} accessibilityLabel="Huddle loading" testID={`${testID}-mark`} />
      ) : (
        <Image
          source={HEARTBEAT_ARTWORK.brand.displayMark}
          resizeMode="contain"
          style={styles.stateMark}
          accessible
          accessibilityLabel="Huddle"
        />
      )}
      <HuddleText variant="title" align="center" accessibilityRole="alert">{title}</HuddleText>
      <HuddleText variant="body" align="center" style={styles.stateMessage}>{message}</HuddleText>
      {action ? (
        <HuddleButton
          title={action.label}
          onPress={action.onPress}
          accessibilityLabel={action.label}
          style={styles.stateAction}
        />
      ) : null}
    </ScreenShell>
  );
}

/** QR/manual identity route: choose a name and collectible before joining. */
export default function JoinIdentityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = usePhoneReducedMotion();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = normalizedCode(Array.isArray(params.code) ? params.code[0] ?? '' : params.code ?? '');
  const {
    session,
    sessionToken,
    completeJoin,
    rememberProfile: cacheProfile,
    beginLeave,
    cancelLeave,
    leave,
  } = usePhoneSession();
  const joinRoom = useMutation(api.players.joinRoom);
  const leaveCurrentRoom = useMutation(api.players.leaveRoom);
  const availability = useQuery(
    api.players.joinAvailability,
    code.length === ROOM_CODE_LENGTH ? { code } : 'skip',
  );
  const [profile, setProfile] = useState<GuestProfileV1>();
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId>('fox');
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isChangingRooms, setIsChangingRooms] = useState(false);
  const [error, setError] = useState<string>();
  const isJoiningRef = useRef(false);
  const nameInputRef = useRef<TextInput>(null);
  const routeState = joinScreenState(session, code);
  const shouldReturnToSeat = routeState.kind === 'seated';

  useEffect(() => {
    let mounted = true;
    void loadGuestProfile(phoneIdentityStore, Crypto.randomUUID)
      .then((loaded) => {
        if (!mounted) return;
        setProfile(loaded);
        setNickname(nicknameEntry(loaded.displayName));
        setAvatarId(loaded.avatarId);
        cacheProfile(loaded);
      })
      .catch(() => {
        if (mounted) setError('Could not prepare your profile. Restart Huddle or go back and try again.');
      });
    return () => {
      mounted = false;
    };
  }, [cacheProfile]);

  useEffect(() => {
    if (shouldReturnToSeat) {
      router.replace('/');
    }
  }, [router, shouldReturnToSeat]);

  const selectedTaken = availability?.takenAvatarIds.includes(avatarId) === true;
  const roomUnavailable = availability === null;
  const pending = availability === undefined;
  const canJoin = session === null && profile !== undefined && nickname.trim() !== '' && !selectedTaken && !pending && !roomUnavailable && availability?.full !== true && !isJoining && !isChangingRooms;
  // A deep link must not evict the current seat until the destination has
  // answered the same capacity check used by the room-code route. Keeping the
  // guard beside the mutation also protects against a stale disabled render or
  // an accessibility action firing between query updates.
  const canChangeRooms = sessionToken !== undefined && availability !== undefined && availability !== null && availability.full !== true && !isChangingRooms;

  const avatarLabels = useMemo(() => {
    return Object.fromEntries(AVATAR_IDS.map((id, index) => [id, `Avatar ${index + 1}`])) as Record<AvatarId, string>;
  }, []);

  if (code.length !== ROOM_CODE_LENGTH) {
    return (
      <IdentityStateSurface
        title="That room link is malformed"
        message="Enter the four-letter code from the TV to join."
        testID="identity-malformed-code"
        action={{ label: 'Enter room code', onPress: () => router.replace('/') }}
      />
    );
  }

  if (routeState.kind === 'restoring') {
    return (
      <IdentityStateSurface
        title="Checking your room"
        message="Making sure this phone does not already hold a seat…"
        testID="identity-session-restoring"
        loading
      />
    );
  }

  if (routeState.kind === 'seated') {
    return (
      <IdentityStateSurface
        title="You’re already in"
        message={`Returning to room ${code}…`}
        testID="identity-same-room"
        loading
      />
    );
  }

  async function changeRooms() {
    if (routeState.kind !== 'handoff' || sessionToken === undefined || !canChangeRooms) return;
    setIsChangingRooms(true);
    setError(undefined);
    beginLeave();
    try {
      await leaveCurrentRoom({ sessionToken });
      await leave();
    } catch (leaveError) {
      cancelLeave();
      setError(hostControlFailureMessage(leaveError));
    } finally {
      setIsChangingRooms(false);
    }
  }

  if (routeState.kind === 'handoff') {
    const currentSession = routeState.session;
    return (
      <ScreenShell tone="background" style={styles.root} testID="identity-room-handoff">
        <View style={[styles.handoff, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
          <HuddleText variant="caption" align="center" style={styles.eyebrow}>CHANGE ROOMS</HuddleText>
          <HuddleText variant="display" align="center">Leave {currentSession.code}?</HuddleText>
          <HuddleText variant="bodyLarge" align="center">You’re already seated in room {currentSession.code}. Leave it before joining room {code} so this phone never holds two seats.</HuddleText>
          {pending ? <HuddleText variant="caption" align="center" accessibilityLiveRegion="polite" testID="identity-handoff-availability-pending">Checking whether room {code} has a seat…</HuddleText> : null}
          {roomUnavailable ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="identity-handoff-room-missing">Room {code} is unavailable. Stay in {currentSession.code} and check the TV.</HuddleText> : null}
          {availability?.full ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="identity-handoff-room-full">Room {code} is full. Stay in {currentSession.code} and ask someone to leave.</HuddleText> : null}
          {canChangeRooms ? <HuddleText variant="caption" align="center" testID="identity-handoff-room-available">Room {code} is ready for you.</HuddleText> : null}
          {error ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="identity-handoff-error">{error}</HuddleText> : null}
          <HuddleButton
            title={`Leave and join ${code}`}
            onPress={() => void changeRooms()}
            busy={isChangingRooms}
            disabled={!canChangeRooms}
            accessibilityLabel={`Leave room ${currentSession.code} and join room ${code}`}
            testID="identity-confirm-handoff"
          />
          <HuddleButton
            title={`Stay in ${currentSession.code}`}
            variant="secondary"
            onPress={() => router.replace('/')}
            disabled={isChangingRooms}
            accessibilityLabel={`Stay in room ${currentSession.code}`}
            testID="identity-cancel-handoff"
          />
        </View>
      </ScreenShell>
    );
  }

  if (isChangingRooms) {
    return (
      <IdentityStateSurface
        title="Changing rooms"
        message={`Finishing the handoff to room ${code}…`}
        testID="identity-handoff-pending"
        loading
      />
    );
  }

  async function submit() {
    // React state does not update until the current event has yielded. Keep a
    // synchronous guard beside the visible busy state so two quick taps cannot
    // mint two seats before the first mutation has settled.
    if (!canJoin || profile === undefined || isJoiningRef.current) return;
    isJoiningRef.current = true;
    setIsJoining(true);
    setError(undefined);
    try {
      const session = await joinRoom({
        code,
        nickname: nickname.trim(),
        avatar: avatarId,
        guestId: profile.guestId,
      });
      // Claim the new credential synchronously before any storage await. A
      // stale-session cleanup already in flight can then see the newer
      // revision and repair this token instead of deleting it.
      completeJoin(session);
      await rememberSession(phoneSessionTokenStore, session.sessionToken);
      const nextProfile: GuestProfileV1 = {
        version: 1,
        guestId: profile.guestId,
        displayName: nickname.trim(),
        avatarId,
      };
      await persistProfile(phoneIdentityStore, nextProfile);
      cacheProfile(nextProfile);
      router.replace('/');
    } catch (joinError) {
      setError(joinFailureMessage(joinError));
    } finally {
      isJoiningRef.current = false;
      setIsJoining(false);
    }
  }

  const compactAvatarIds = AVATAR_IDS.slice(0, 5);
  const visibleAvatarIds = showAllAvatars ? AVATAR_IDS : compactAvatarIds;

  return (
    <ScreenShell tone="background" style={styles.root} testID="identity-screen">
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, reducedMotion !== undefined ? styles.contentReady : null]}>
            <View style={styles.topRow}>
              <HuddleButton
                variant="ghost"
                onPress={() => router.replace('/')}
                accessibilityLabel="Back to room code"
                testID="identity-back"
                style={styles.backButton}
              >
                <HuddleText variant="body" align="center" accessible={false} style={styles.backArrow}>←</HuddleText>
              </HuddleButton>
              <Image
                source={HEARTBEAT_ARTWORK.brand.displayMark}
                resizeMode="contain"
                style={styles.brandMark}
                accessible
                accessibilityLabel="Huddle"
                testID="identity-huddle-mark"
              />
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.headerCopy}>
              <HuddleText variant="title" align="center">Pick your vibe</HuddleText>
              <HuddleText variant="body" align="center" style={styles.subtitle}>Choose an avatar and a name</HuddleText>
            </View>

            {!showAllAvatars ? (
              <View style={styles.heroFrame}>
                <Image
                  source={HEARTBEAT_ARTWORK.phone.identitySunnyHero}
                  resizeMode="contain"
                  style={styles.heroArtwork}
                  accessible
                  accessibilityLabel="Sunny, a red bear, in a little garden"
                  testID="identity-sunny-hero"
                />
                {profile ? (
                  <View style={styles.welcomeBadge} accessible accessibilityLabel="Welcome back">
                    <HuddleText variant="caption">♡ Welcome back</HuddleText>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showAllAvatars ? (
              <View style={styles.avatarPickerPrompt} accessible accessibilityLiveRegion="polite">
                <HuddleText variant="body">Choose an available avatar.</HuddleText>
              </View>
            ) : null}

            {showAllAvatars ? (
              <View style={styles.avatarGrid} testID="identity-avatar-grid">
                {visibleAvatarIds.map((candidate) => {
                  const taken = availability?.takenAvatarIds.includes(candidate) === true;
                  const selected = candidate === avatarId;
                  return (
                    <View key={candidate} style={styles.avatarCell}>
                      <AvatarPortrait
                        avatarId={candidate}
                        size={52}
                        selected={selected}
                        disabled={taken}
                        onPress={taken ? undefined : () => {
                          setAvatarId(candidate);
                          setError(undefined);
                        }}
                        displayName={avatarLabels[candidate]}
                        testID={`identity-avatar-${candidate}`}
                        style={styles.avatarTile}
                      />
                      {taken ? <HuddleText variant="caption" align="center" style={styles.taken}>Taken</HuddleText> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.nameSection}>
              <HuddleText variant="caption" style={styles.fieldLabel}>Name</HuddleText>
              <View style={styles.nameField}>
                <TextInput
                  ref={nameInputRef}
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(nicknameEntry(value));
                    setError(undefined);
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(43,31,23,0.42)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={NICKNAME_MAX_LENGTH * 2}
                  returnKeyType="done"
                  onSubmitEditing={() => void submit()}
                  style={styles.nameInput}
                  accessibilityLabel="Display name"
                  testID="identity-display-name"
                />
                <HuddleText variant="title" style={styles.editIcon} accessibilityElementsHidden>✎</HuddleText>
              </View>
            </View>

            {!showAllAvatars ? (
              <View style={styles.compactPicker}>
                <View style={styles.compactAvatarRow} testID="identity-avatar-grid">
                  {visibleAvatarIds.map((candidate) => {
                    const taken = availability?.takenAvatarIds.includes(candidate) === true;
                    const selected = candidate === avatarId;
                    return (
                      <View key={candidate} style={styles.avatarCell}>
                        <AvatarPortrait
                          avatarId={candidate}
                          size={48}
                          selected={selected}
                          disabled={taken}
                          onPress={taken ? undefined : () => {
                            setAvatarId(candidate);
                            setError(undefined);
                          }}
                          displayName={avatarLabels[candidate]}
                          testID={`identity-avatar-${candidate}`}
                          style={styles.avatarTile}
                        />
                        {taken ? <HuddleText variant="caption" align="center" style={styles.taken}>Taken</HuddleText> : null}
                      </View>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => setShowAllAvatars(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choose another avatar"
                  testID="identity-show-all-avatars"
                  style={styles.avatarExpand}
                >
                  <HuddleText variant="caption" style={styles.avatarExpandText}>Choose another avatar</HuddleText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowAllAvatars(false)}
                accessibilityRole="button"
                accessibilityLabel="Show selected avatar"
                testID="identity-show-selected-avatar"
                style={styles.avatarExpand}
              >
                <HuddleText variant="caption" style={styles.avatarExpandText}>Show selected avatar</HuddleText>
              </Pressable>
            )}

            {pending ? <HuddleText variant="caption" color="text" align="center" accessibilityLiveRegion="polite" testID="identity-availability-pending">Checking room availability…</HuddleText> : null}
            {roomUnavailable ? <View style={styles.inlineError} accessible accessibilityRole="alert" testID="identity-room-missing"><HuddleText variant="caption" align="center">No room has that code. Go back and check the TV.</HuddleText></View> : null}
            {availability?.full ? <View style={styles.inlineError} accessible accessibilityRole="alert" testID="identity-room-full"><HuddleText variant="caption" align="center">That room is full. Ask someone to leave before joining.</HuddleText></View> : null}
            {selectedTaken ? <View style={styles.inlineError} accessible accessibilityRole="alert" testID="identity-avatar-taken"><HuddleText variant="caption" align="center">That avatar is already in use. Pick another one.</HuddleText></View> : null}
            {error ? <View style={styles.inlineError} accessible accessibilityRole="alert" testID="identity-error"><HuddleText variant="caption" align="center">{error}</HuddleText></View> : null}

            <HuddleButton
              title={isJoining ? 'Joining room…' : 'Join room'}
              onPress={() => void submit()}
              busy={isJoining}
              disabled={!canJoin}
              accessibilityLabel="Join room"
              testID="identity-join"
              style={styles.joinButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {isJoining ? (
        <View style={styles.joiningOverlay} accessible accessibilityRole="alert" accessibilityLabel="Joining room" testID="identity-joining-overlay">
          <View style={styles.joiningPanel}>
            <Image
              source={HEARTBEAT_ARTWORK.brand.displayMark}
              resizeMode="contain"
              style={styles.joiningMark}
              accessible={false}
            />
            <HuddleText variant="title" align="center">Joining room…</HuddleText>
            <View style={styles.joiningDots} accessibilityElementsHidden>
              <View style={[styles.joiningDot, styles.joiningDotActive]} />
              <View style={styles.joiningDot} />
              <View style={styles.joiningDot} />
              <View style={styles.joiningDot} />
            </View>
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 0, overflow: 'hidden' },
  stateRoot: { paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  stateMark: { width: 72, height: 68, marginBottom: spacing.lg },
  stateMessage: { maxWidth: 320, opacity: 0.72 },
  stateAction: { width: '100%', maxWidth: 320, minHeight: 52, borderRadius: radii.md, marginTop: spacing.md },
  handoff: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  eyebrow: { letterSpacing: 1.2, opacity: 0.68 },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 390, alignSelf: 'center', paddingHorizontal: spacing.xl, gap: spacing.md, opacity: 0.95 },
  contentReady: { opacity: 1 },
  topRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, minHeight: 40, paddingHorizontal: 0, paddingVertical: 0, borderColor: 'rgba(43,31,23,0.16)', borderWidth: 1, borderRadius: radii.round },
  backArrow: { fontSize: 24, lineHeight: 24, fontWeight: '700' },
  brandMark: { width: 44, height: 40 },
  headerSpacer: { width: 40, height: 40 },
  headerCopy: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  subtitle: { maxWidth: 290, opacity: 0.9 },
  heroFrame: { position: 'relative', width: '100%', height: 208, marginTop: spacing.xs, marginBottom: spacing.xs },
  heroArtwork: { width: '100%', height: '100%' },
  welcomeBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.md, backgroundColor: 'rgba(230,163,177,0.34)' },
  avatarPickerPrompt: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: 'rgba(230,163,177,0.34)' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md, paddingVertical: spacing.sm },
  compactPicker: { alignItems: 'center', gap: spacing.sm },
  compactAvatarRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  avatarCell: { width: '18%', minWidth: 48, alignItems: 'center', gap: spacing.xs },
  avatarTile: { borderRadius: radii.md },
  taken: { color: brandColors.dustyRose, fontSize: 10, lineHeight: 12 },
  avatarExpand: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  avatarExpandText: { color: brandColors.espresso, textDecorationLine: 'underline', opacity: 0.72 },
  nameSection: { gap: spacing.xs, marginTop: spacing.xs },
  fieldLabel: { opacity: 0.88 },
  nameField: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(43,31,23,0.16)', borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: spacing.md },
  nameInput: { ...typography.bodyLarge, flex: 1, color: brandColors.espresso, minHeight: 50, paddingVertical: spacing.sm },
  editIcon: { fontSize: 18, lineHeight: 24, opacity: 0.82 },
  inlineError: { width: '100%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: 'rgba(230,163,177,0.28)' },
  joinButton: { minHeight: 52, borderRadius: radii.md, marginTop: 'auto', marginBottom: spacing.lg },
  joiningOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(43,31,23,0.46)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  joiningPanel: { width: '100%', maxWidth: 330, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, borderRadius: radii.xl, backgroundColor: brandColors.cream, padding: spacing.xl },
  joiningMark: { width: 68, height: 62 },
  joiningDots: { flexDirection: 'row', gap: spacing.sm },
  joiningDot: { width: 8, height: 8, borderRadius: radii.round, backgroundColor: 'rgba(43,31,23,0.14)' },
  joiningDotActive: { backgroundColor: brandColors.coral },
});
