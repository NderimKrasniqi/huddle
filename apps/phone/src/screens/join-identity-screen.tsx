import { AVATAR_IDS, NICKNAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomButton,
  PlayroomHeading,
  PlayroomStatusImage,
  PlayroomText,
  PlayroomWordmark,
  PlayroomPressable,
} from '@huddle/ui/native';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nicknameEntry } from '../features/join/join-entry';
import { useJoinIdentity } from './use-join-identity';
import { ConnectionProblemScreen } from './connection-problem-screen';
import { PhoneFrame, PhoneNotice, PhoneTopBar } from './seated/phone-frame';

type IdentityStateSurfaceProps = {
  readonly title: string;
  readonly message: string;
  readonly testID: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly loading?: boolean;
};

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

export default function JoinIdentityScreen() {
  const insets = useSafeAreaInsets();
  const { availability, avatarId, avatarLabels, canChangeRooms, canJoin, changeRooms, code, error, isChangingRooms, isJoining, nickname, pending, problem, profile, room, roomUnavailable, routeState, router, selectedTaken, setAvatarId, setAvatarPicked, setError, setNickname, submit } = useJoinIdentity();

  if (problem !== undefined && (routeState.kind === 'joining' || routeState.kind === 'handoff')) {
    return <ConnectionProblemScreen problem={problem} onRetry={room.retryConnection} />;
  }

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


  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>
      <PhoneFrame
        avatarId={avatarId}
        testID="identity-screen"
        footer={
          <PlayroomButton
            label={isJoining ? 'Joining room…' : 'I’m in!'}
            onPress={() => void submit()}
            busy={isJoining}
            disabled={!canJoin}
            accessibilityLabel="Join room"
            testID="identity-join"
          />
        }
      >
        <PhoneTopBar back={{ label: `Room ${code}`, onPress: () => router.replace('/'), testID: 'identity-back' }} />
        <PlayroomHeading type={playroomPhone.type.heading}>Make an entrance</PlayroomHeading>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {profile ? 'Welcome back! This is how everyone will see you.' : 'This is how everyone will see you.'}
        </PlayroomText>
        <View style={[styles.pass, { backgroundColor: playroomAvatarCircles[avatarId] }]}>
          <PlayroomAvatar avatarId={avatarId} size={88} />
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
              accessibilityHint="Edit the name shown in the room"
              accessibilityLabel="Display name"
              testID="identity-display-name"
            />
            <PlayroomText color="muted" style={playroomPhone.type.caption} accessibilityElementsHidden>
              {`${nickname.length}/${NICKNAME_MAX_LENGTH}`}
            </PlayroomText>
          </View>
        </View>
        </View>
        {nickname.trim() === '' ? <Line testID="identity-name-hint">Add your name to save your seat.</Line> : null}
        <View style={styles.picker}>
        <PlayroomText color="muted" style={[playroomPhone.type.label, styles.gridLabel]}>Pick your look</PlayroomText>
        <View style={styles.grid} testID="identity-avatar-grid">
          {AVATAR_IDS.map((candidate) => {
            const taken = availability?.takenAvatarIds.includes(candidate) === true;
            const selected = candidate === avatarId;
            return (
              <PlayroomPressable
                key={candidate}
                onPress={() => {
                  setAvatarId(candidate);
                  setAvatarPicked(true);
                  setError(undefined);
                }}
                disabled={taken}
                accessibilityRole="button"
                accessibilityLabel={`${avatarLabels[candidate]}${taken ? ', taken' : ''}`}
                accessibilityState={{ selected, disabled: taken }}
                testID={`identity-avatar-${candidate}`}
                style={styles.cell}
              >
                <View>
                  <View style={[styles.ring, selected ? styles.ringOn : null, taken ? styles.taken : null]}>
                    <PlayroomAvatar avatarId={candidate} size={54} />
                  </View>
                  {selected ? (
                    <View style={styles.check}>
                      <View style={styles.tick} />
                    </View>
                  ) : null}
                  {taken ? (
                    <View style={[styles.check, styles.takenBadge]}>
                      <View style={styles.takenBar} />
                    </View>
                  ) : null}
                </View>
              </PlayroomPressable>
            );
          })}
        </View>
        </View>
        {pending ? <Line testID="identity-availability-pending">Checking room availability…</Line> : null}
        {availability?.full ? <PhoneNotice testID="identity-room-full">That room is full. Ask someone to leave before joining.</PhoneNotice> : null}
        {selectedTaken ? <PhoneNotice testID="identity-avatar-taken">Someone just took that avatar. Pick another one.</PhoneNotice> : null}
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
    rowGap: 36,
    marginTop: 4,
  },
  picker: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  gridLabel: {
    marginTop: 16,
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
    opacity: 0.3,
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
  takenBadge: {
    backgroundColor: playroomColors.muted,
  },
  takenBar: {
    width: 10,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: playroomColors.surface,
  },
  pass: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: playroomRadii.card },
  field: {
    flex: 1,
    gap: 6,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: playroomRadii.input,
    borderWidth: 1,
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
