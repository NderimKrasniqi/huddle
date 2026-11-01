import { AVATAR_IDS, type AvatarId, type GuestProfileV1, normalizeRoomCode, ROOM_CODE_ACCEPTED_ALPHABET, ROOM_CODE_LENGTH } from '@huddle/domain';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoomClient } from '../platform/room-client/native';
import { joinScreenState, usePhoneSession } from '../platform/session';
import { phoneIdentityStore } from '../platform/storage/native';
import { hostControlFailureMessage } from '../features/room';
import { lanFromJoinParams } from '../features/scan';
import { codeEntry, joinFailureMessage, loadGuestProfile, nicknameEntry, rememberProfile as persistProfile } from '../features/join';
import { useSeatPreview, useScreenFocused } from '../features/join/native';

function normalizedCode(value: string): string {
  const normalized = [...normalizeRoomCode(value)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');
  return codeEntry(normalized);
}

export function useJoinIdentity() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; hosts?: string; port?: string; tv?: string; relay?: string }>();
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
  const room = useRoomClient();
  const problem = room.useConnectionProblem();
  const linkedLan = useMemo(
    () => lanFromJoinParams(code, { hosts: params.hosts, port: params.port, tv: params.tv, relay: params.relay }),
    [code, params.hosts, params.port, params.tv, params.relay],
  );
  useMemo(() => {
    if (linkedLan !== undefined) room.rememberTv?.(code, linkedLan);
  }, [code, linkedLan, room]);
  const focused = useScreenFocused();
  const availability = room.useJoinAvailability(focused && code.length === ROOM_CODE_LENGTH ? code : undefined);
  const [profile, setProfile] = useState<GuestProfileV1>();
  const [nickname, setNickname] = useState('');
  const [chosenAvatarId, setAvatarId] = useState<AvatarId>('fox');
  const [avatarPicked, setAvatarPicked] = useState(false);
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

  const linkedRoomMissing = routeState.kind === 'joining' && availability === null;
  // Only the visible join screen may navigate; earlier ones stay mounted underneath.
  useFocusEffect(
    useCallback(() => {
      if (linkedRoomMissing) router.replace({ pathname: '/', params: { code } });
    }, [code, linkedRoomMissing, router]),
  );

  useFocusEffect(
    useCallback(() => {
      if (shouldReturnToSeat) router.replace('/');
    }, [router, shouldReturnToSeat]),
  );

  const isTaken = (candidate: AvatarId) => availability?.takenAvatarIds.includes(candidate) === true;
  const firstFreeAvatar = AVATAR_IDS.find((candidate) => !isTaken(candidate));
  const avatarId = !avatarPicked && isTaken(chosenAvatarId) && firstFreeAvatar !== undefined ? firstFreeAvatar : chosenAvatarId;
  const selectedTaken = isTaken(avatarId);
  const roomUnavailable = availability === null;
  const pending = availability === undefined;
  const canJoin = session === null && profile !== undefined && nickname.trim() !== '' && !selectedTaken && !pending && !roomUnavailable && availability?.full !== true && !isJoining && !isChangingRooms;
  useSeatPreview({
    code,
    nickname,
    avatarId,
    active: session === null && profile !== undefined && availability !== undefined && availability !== null && availability.full !== true && !selectedTaken && !isJoining,
  });
  const canChangeRooms = sessionToken !== undefined && availability !== undefined && availability !== null && availability.full !== true && !isChangingRooms;

  const avatarLabels = useMemo(() => {
    return Object.fromEntries(AVATAR_IDS.map((id, index) => [id, `Avatar ${index + 1}`])) as Record<AvatarId, string>;
  }, []);

  async function changeRooms() {
    if (routeState.kind !== 'handoff' || sessionToken === undefined || session === null || session === undefined || !canChangeRooms) return;
    setIsChangingRooms(true);
    setError(undefined);
    beginLeave();
    try {
      await room.command('leaveRoom', sessionToken, {});
      await leave();
    } catch (leaveError) {
      cancelLeave();
      setError(hostControlFailureMessage(leaveError));
    } finally {
      setIsChangingRooms(false);
    }
  }
  async function submit() {
    // State updates land after this event; the ref stops a double tap minting two seats.
    if (!canJoin || profile === undefined || isJoiningRef.current) return;
    isJoiningRef.current = true;
    setIsJoining(true);
    setError(undefined);
    try {
      const session = await room.joinRoom({
        code,
        nickname: nickname.trim(),
        avatar: avatarId,
        guestId: profile.guestId,
      });
      completeJoin(session);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  return { availability, avatarId, avatarLabels, canChangeRooms, canJoin, changeRooms, code, error, isChangingRooms, isJoining, leave, nickname, pending, problem, profile, room, roomUnavailable, routeState, router, selectedTaken, session, setAvatarId, setAvatarPicked, setError, setNickname, submit };
}
