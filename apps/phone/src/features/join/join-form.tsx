import { api } from '@huddle/convex';
import type { AvatarId, GuestProfileV1 } from '@huddle/domain';
import { huddleAvatarSource } from '@huddle/ui/native';
import * as Crypto from 'expo-crypto';
import { type Href, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';

import type { PlayerSession } from '../../platform/session';
import { rememberSession } from '../../platform/session';
import { phoneSessionTokenStore } from '../../platform/session/native';
import { phoneIdentityStore } from '../../platform/storage/native';
import { joinFailureMessage } from './join-rejection';
import { codeEntry } from './join-entry';
import { loadGuestProfile, rememberProfile } from './identity';
import { JoinRoomScreen } from './join-room-screen';

export type JoinFormProps = {
  readonly linkedCode: string;
  readonly onSeated: (session: PlayerSession) => void;
  readonly notice?: string;
};

/**
 * Route-facing adapter for the Join Room flow. It keeps Convex membership,
 * local identity/session persistence, and navigation out of the illustrated
 * renderer while handing that renderer a small authoritative projection.
 */
export function JoinForm(props: JoinFormProps) {
  const router = useRouter();
  const joinRoom = useMutation(api.players.joinRoom);
  const [profile, setProfile] = useState<GuestProfileV1>();
  const [availabilityCode, setAvailabilityCode] = useState(() => codeEntry(props.linkedCode));
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string>();
  const isJoiningRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void loadGuestProfile(phoneIdentityStore, Crypto.randomUUID).then((loaded) => {
      if (mounted) setProfile(loaded);
    }).catch(() => {
      // `loadGuestProfile` normally handles storage failures, but a broken UUID
      // implementation should leave the draft visible with an actionable
      // explanation rather than making Join appear to do nothing.
      if (mounted) setError('Could not prepare your local profile. Restart Huddle and try again.');
    });
    return () => {
      mounted = false;
    };
  }, []);

  const availability = useQuery(
    api.players.joinAvailability,
    availabilityCode.length === 4 ? { code: availabilityCode } : 'skip',
  );

  async function handleJoin(input: {
    readonly code: string;
    readonly nickname: string;
    readonly avatarId: AvatarId;
  }) {
    if (isJoining || isJoiningRef.current || profile === undefined) return;
    isJoiningRef.current = true;
    setIsJoining(true);
    setError(undefined);
    try {
      const session = await joinRoom({
        code: input.code,
        nickname: input.nickname,
        avatar: input.avatarId,
        guestId: profile.guestId,
      });
      await rememberSession(phoneSessionTokenStore, session.sessionToken);
      await rememberProfile(phoneIdentityStore, {
        version: 1,
        guestId: profile.guestId,
        displayName: input.nickname,
        avatarId: input.avatarId,
      });
      props.onSeated(session);
    } catch (joinError) {
      setError(joinFailureMessage(joinError));
    } finally {
      isJoiningRef.current = false;
      setIsJoining(false);
    }
  }

  return (
    <JoinRoomScreen
      initialCode={props.linkedCode}
      initialProfile={profile}
      identityReady={profile !== undefined}
      avatarSource={huddleAvatarSource}
      availability={availability}
      isJoining={isJoining}
      error={error}
      notice={props.notice}
      onJoinRoom={handleJoin}
      onCodeChange={setAvailabilityCode}
      onScanQr={() => router.push('/scan' as Href)}
    />
  );
}
