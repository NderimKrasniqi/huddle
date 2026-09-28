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
import { playroomColors, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomButton,
  PlayroomHeading,
  PlayroomStatusImage,
  PlayroomText,
  PlayroomWordmark,
} from '@huddle/ui/native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { joinFailureMessage } from '../features/join/join-rejection';
import { rememberProfile as persistProfile, loadGuestProfile } from '../features/join/identity';
import { codeEntry, nicknameEntry } from '../features/join/join-entry';
import { hostControlFailureMessage } from '../features/room';
import { phoneSessionTokenStore } from '../platform/session/native';
import { joinScreenState, rememberSession, usePhoneSession } from '../platform/session';
import { phoneIdentityStore } from '../platform/storage/native';
import { PhoneFrame, PhoneNotice, PhoneTopBar } from './seated/phone-frame';

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

/** A full-screen state for deep-link and restoration guards. */
function IdentityStateSurface({ title, message, testID, action, loading = false }: IdentityStateSurfaceProps) {
  return (
    <PhoneFrame
      testID={testID}
      contentStyle={styles.state}
      footer={action ? <PlayroomButton label={action.label} onPress={action.onPress} accessibilityLabel={action.label} /> : undefined}
    >
      <PlayroomWordmark height={34} />
      <PlayroomStatusImage art={loading ? 'loading' : 'roomNotFound'} width={200} height={200} />
      <PlayroomText accessibilityRole="alert" style={[playroomPhone.type.heading, styles.center]}>
        {title}
      </PlayroomText>
      <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
        {message}
      </PlayroomText>
    </PhoneFrame>
  );
}

/** QR/manual identity route: choose a name and collectible before joining. */
export default function JoinIdentityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [isJoining, setIsJoining] = useState(false);
  const [isChangingRooms, setIsChangingRooms] = useState(false);
  const [error, setError] = useState<string>();
  const isJoiningRef = useRef(false);
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
      <PhoneFrame
        testID="identity-room-handoff"
        contentStyle={styles.state}
        footer={
          <>
            <PlayroomButton
              label={`Leave and join ${code}`}
              onPress={() => void changeRooms()}
              busy={isChangingRooms}
              disabled={!canChangeRooms}
              accessibilityLabel={`Leave room ${currentSession.code} and join room ${code}`}
              testID="identity-confirm-handoff"
            />
            <PlayroomButton
              label={`Stay in ${currentSession.code}`}
              variant="secondary"
              onPress={() => router.replace('/')}
              disabled={isChangingRooms}
              accessibilityLabel={`Stay in room ${currentSession.code}`}
              testID="identity-cancel-handoff"
            />
          </>
        }
      >
        <PlayroomStatusImage art="leftRoom" width={180} height={180} />
        <PlayroomHeading type={playroomPhone.type.heading}>{`Leave ${currentSession.code}?`}</PlayroomHeading>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {`You’re already seated in room ${currentSession.code}. Leave it before joining room ${code} so this phone never holds two seats.`}
        </PlayroomText>
        {pending ? <Line testID="identity-handoff-availability-pending">{`Checking whether room ${code} has a seat…`}</Line> : null}
        {roomUnavailable ? <PhoneNotice testID="identity-handoff-room-missing">{`Room ${code} is unavailable. Stay in ${currentSession.code} and check the TV.`}</PhoneNotice> : null}
        {availability?.full ? <PhoneNotice testID="identity-handoff-room-full">{`Room ${code} is full. Stay in ${currentSession.code} and ask someone to leave.`}</PhoneNotice> : null}
        {canChangeRooms ? <Line testID="identity-handoff-room-available">{`Room ${code} is ready for you.`}</Line> : null}
        {error ? <PhoneNotice testID="identity-handoff-error">{error}</PhoneNotice> : null}
      </PhoneFrame>
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

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>
      <PhoneFrame
        avatarId={avatarId}
        testID="identity-screen"
        footer={
          <PlayroomButton
            label={isJoining ? 'Joining room…' : 'Let’s go!'}
            bursts
            onPress={() => void submit()}
            busy={isJoining}
            disabled={!canJoin}
            accessibilityLabel="Join room"
            testID="identity-join"
          />
        }
      >
        <PhoneTopBar back={{ label: `Room ${code}`, onPress: () => router.replace('/'), testID: 'identity-back' }} />
        <PlayroomHeading type={playroomPhone.type.heading}>Pick your look</PlayroomHeading>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {profile ? 'Welcome back! This is how everyone will see you.' : 'This is how everyone will see you.'}
        </PlayroomText>
        <View style={styles.grid} testID="identity-avatar-grid">
          {AVATAR_IDS.map((candidate) => {
            const taken = availability?.takenAvatarIds.includes(candidate) === true;
            const selected = candidate === avatarId;
            return (
              <Pressable
                key={candidate}
                onPress={() => {
                  setAvatarId(candidate);
                  setError(undefined);
                }}
                disabled={taken}
                accessibilityRole="button"
                accessibilityLabel={`${avatarLabels[candidate]}${taken ? ', taken' : ''}`}
                accessibilityState={{ selected, disabled: taken }}
                testID={`identity-avatar-${candidate}`}
                style={styles.cell}
              >
                <View style={[styles.ring, selected ? styles.ringOn : null, taken ? styles.taken : null]}>
                  <PlayroomAvatar avatarId={candidate} size={54} />
                </View>
                {selected ? (
                  <View style={styles.check}>
                    <View style={styles.tick} />
                  </View>
                ) : null}
                {taken ? (
                  <PlayroomText color="muted" style={styles.takenLabel}>
                    Taken
                  </PlayroomText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.field}>
          <PlayroomText color="muted" style={playroomPhone.type.caption}>
            Your name
          </PlayroomText>
          <View style={styles.input}>
            <TextInput
              value={nickname}
              onChangeText={(value) => {
                setNickname(nicknameEntry(value));
                setError(undefined);
              }}
              placeholder="Enter your name"
              placeholderTextColor={playroomColors.muted}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={NICKNAME_MAX_LENGTH * 2}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              style={styles.inputText}
              accessibilityLabel="Display name"
              testID="identity-display-name"
            />
            <PlayroomText color="muted" style={playroomPhone.type.caption} accessibilityElementsHidden>
              {`${nickname.length}/${NICKNAME_MAX_LENGTH}`}
            </PlayroomText>
          </View>
        </View>
        {pending ? <Line testID="identity-availability-pending">Checking room availability…</Line> : null}
        {roomUnavailable ? <PhoneNotice testID="identity-room-missing">No room has that code. Go back and check the TV.</PhoneNotice> : null}
        {availability?.full ? <PhoneNotice testID="identity-room-full">That room is full. Ask someone to leave before joining.</PhoneNotice> : null}
        {selectedTaken ? <PhoneNotice testID="identity-avatar-taken">That avatar is already in use. Pick another one.</PhoneNotice> : null}
        {error ? <PhoneNotice testID="identity-error">{error}</PhoneNotice> : null}
      </PhoneFrame>
    </KeyboardAvoidingView>
  );
}

function Line({ children, testID }: { readonly children: string; readonly testID: string }) {
  return (
    <PlayroomText color="muted" style={[playroomPhone.type.caption, styles.center]} accessibilityLiveRegion="polite" testID={testID}>
      {children}
    </PlayroomText>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
    marginTop: 12,
  },
  cell: {
    width: '19%',
    alignItems: 'center',
  },
  ring: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  ringOn: {
    borderColor: playroomColors.ink,
  },
  taken: {
    opacity: 0.35,
  },
  check: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: playroomColors.canvas,
    backgroundColor: playroomColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 5,
    height: 9,
    marginTop: -2,
    borderColor: playroomColors.surface,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  takenLabel: {
    ...playroomPhone.type.caption,
    fontSize: 11,
  },
  field: {
    gap: 6,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: playroomRadii.input,
    borderWidth: 2,
    borderColor: playroomColors.border,
    backgroundColor: playroomColors.surface,
  },
  inputText: {
    flex: 1,
    ...playroomPhone.type.title,
    color: playroomColors.ink,
    paddingVertical: 10,
  },
});
