import type { GuestProfileV1 } from '@huddle/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useRoomClient } from '../room-client/native';
import type { PlayerSession } from './session';

export type PhoneSessionContextValue = {
  readonly session: PlayerSession | null | undefined;
  readonly sessionToken: string | undefined;
  readonly restoringToken: boolean;
  readonly joinWelcomeUntil?: number;
  readonly notice: string | undefined;
  readonly rememberedProfile: GuestProfileV1 | undefined;
  readonly seat: PlayerSession | null | undefined;
  readonly completeJoin: (session: PlayerSession & { readonly sessionToken: string }) => void;
  readonly rememberProfile: (profile: GuestProfileV1) => void;
  readonly beginLeave: () => void;
  readonly cancelLeave: () => void;
  readonly reportSeatLost: (reason: string) => void;
  readonly leave: () => Promise<void>;
  readonly clearNotice: () => void;
};

const PhoneSessionContext = createContext<PhoneSessionContextValue | null>(null);

const RESTORED_SEAT_GONE = 'Your seat was freed while Huddle was closed. Join again with the code on the TV.';
const RESTORE_LIMIT_MS = 5_000;
const JOIN_WELCOME_MS = 4_600;

export function PhoneSessionProvider({ children }: PropsWithChildren) {
  const room = useRoomClient();
  const [session, setSession] = useState<PlayerSession | null | undefined>();
  const [sessionToken, setSessionToken] = useState<string>();
  const [restoringToken, setRestoringToken] = useState(false);
  const [joinWelcomeUntil, setJoinWelcomeUntil] = useState<number>();
  const [notice, setNotice] = useState<string>();
  const [rememberedProfile, setRememberedProfile] = useState<GuestProfileV1>();
  // A join or leave during the launch restore wins over whatever the restore finds.
  const decided = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (joinWelcomeUntil === undefined) return;
    const timer = setTimeout(() => setJoinWelcomeUntil(undefined), Math.max(0, joinWelcomeUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [joinWelcomeUntil]);

  const seat = useCallback((next: PlayerSession | null, token: string | undefined) => {
    setSession(next);
    setSessionToken(next === null ? undefined : token);
    if (next === null) setJoinWelcomeUntil(undefined);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const token = await room.savedSeatToken();
      if (!live || decided.current) return;
      if (token === undefined) {
        seat(null, undefined);
        return;
      }
      setRestoringToken(true);
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), RESTORE_LIMIT_MS));
      const found = await Promise.race([room.lookupSession(token), timeout]).catch(() => 'unreachable' as const);
      if (!live || decided.current) return;
      setRestoringToken(false);
      if (found === null) {
        // The TV answered and the seat is gone.
        await room.forgetSeat(token);
        setNotice(RESTORED_SEAT_GONE);
      }
      seat(typeof found === 'object' && found !== null ? found : null, token);
    })();
    return () => {
      live = false;
    };
  }, [room, seat]);

  const completeJoin = useCallback((next: PlayerSession & { readonly sessionToken: string }) => {
    const { sessionToken: joinedToken, ...publicSeat } = next;
    decided.current = true;
    leaving.current = false;
    setRestoringToken(false);
    seat(publicSeat, joinedToken);
    setJoinWelcomeUntil(Date.now() + JOIN_WELCOME_MS);
    setNotice(undefined);
  }, [seat]);

  const rememberProfile = useCallback((profile: GuestProfileV1) => setRememberedProfile(profile), []);
  const beginLeave = useCallback(() => {
    leaving.current = true;
  }, []);
  const cancelLeave = useCallback(() => {
    leaving.current = false;
  }, []);

  const reportSeatLost = useCallback((reason: string) => {
    decided.current = true;
    if (!leaving.current) {
      setNotice(reason);
      if (sessionToken !== undefined) void room.forgetSeat(sessionToken);
    }
    seat(null, undefined);
  }, [room, seat, sessionToken]);

  const leave = useCallback(async () => {
    decided.current = true;
    leaving.current = true;
    if (sessionToken !== undefined) await room.forgetSeat(sessionToken);
    setNotice(undefined);
    seat(null, undefined);
  }, [room, seat, sessionToken]);

  const clearNotice = useCallback(() => setNotice(undefined), []);
  const value = useMemo<PhoneSessionContextValue>(() => ({
    session,
    seat: session,
    sessionToken,
    restoringToken,
    joinWelcomeUntil,
    notice,
    rememberedProfile,
    completeJoin,
    rememberProfile,
    beginLeave,
    cancelLeave,
    reportSeatLost,
    leave,
    clearNotice,
  }), [beginLeave, cancelLeave, clearNotice, completeJoin, joinWelcomeUntil, leave, notice, rememberProfile, rememberedProfile, reportSeatLost, restoringToken, session, sessionToken]);

  return <PhoneSessionContext.Provider value={value}>{children}</PhoneSessionContext.Provider>;
}

export function usePhoneSession(): PhoneSessionContextValue {
  const value = useContext(PhoneSessionContext);
  if (value === null) throw new Error('usePhoneSession must be used inside PhoneSessionProvider');
  return value;
}
