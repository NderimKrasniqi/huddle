import { api } from '@huddle/convex';
import type { GuestProfileV1 } from '@huddle/domain';
import { useConvex } from 'convex/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import {
  forgetSession,
  rememberSession,
  resumeSession,
  resumeReportState,
  shouldClearRestoredCredential,
  type ResumeLookupResult,
  type PlayerSession,
  type SessionTokenStatus,
} from './session';
import { phoneSessionTokenStore } from './native';

export type PhoneSessionContextValue = {
  readonly session: PlayerSession | null | undefined;
  readonly sessionToken: string | undefined;
  readonly restoringToken: boolean;
  readonly notice: string | undefined;
  readonly rememberedProfile: GuestProfileV1 | undefined;
  readonly seat: PlayerSession | null | undefined;
  readonly completeJoin: (session: PlayerSession & { readonly sessionToken: string }) => void;
  readonly rememberProfile: (profile: GuestProfileV1) => void;
  /** Marks a user-initiated Leave before its authoritative mutation can update subscriptions. */
  readonly beginLeave: () => void;
  /** Rolls back a Leave marker when the authoritative mutation is refused. */
  readonly cancelLeave: () => void;
  readonly reportSeatLost: (reason: string) => void;
  readonly leave: () => Promise<void>;
  readonly clearNotice: () => void;
};

const PhoneSessionContext = createContext<PhoneSessionContextValue | null>(null);

/**
 * Room credential and lifecycle authority shared by every Phone route.
 *
 * The lookup intentionally delegates to `resumeSession`, including its late
 * answer behavior: a slow session query may fill the form after its patience
 * deadline, but it can never overwrite a newly joined seat.
 */
export function PhoneSessionProvider({ children }: PropsWithChildren) {
  const convex = useConvex();
  const [session, setSession] = useState<PlayerSession | null | undefined>();
  const [restoringToken, setRestoringToken] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [rememberedProfile, setRememberedProfile] = useState<GuestProfileV1>();
  const candidateTokenRef = useRef<string | undefined>(undefined);
  const activeSessionRef = useRef<PlayerSession | null | undefined>(undefined);
  const activeTokenRef = useRef<string | undefined>(undefined);
  const ignoreLateResumeRef = useRef(false);
  const deliberateLeaveRef = useRef(false);
  const credentialRevisionRef = useRef(0);
  const restoreLookupResultRef = useRef<ResumeLookupResult>('pending');
  const restoreNullClearedRef = useRef(false);

  const clearPersistedCredential = useCallback(() => {
    const revision = credentialRevisionRef.current;
    void forgetSession(phoneSessionTokenStore).then(() => {
      // A stale clear may finish after a newer join has written its token. Put
      // that newer credential back so storage latency cannot undo the winner.
      if (credentialRevisionRef.current === revision) return;
      const currentToken = activeTokenRef.current;
      if (currentToken !== undefined) void rememberSession(phoneSessionTokenStore, currentToken);
    });
  }, []);

  useEffect(() => {
    restoreLookupResultRef.current = 'pending';
    return resumeSession(
      phoneSessionTokenStore,
      async (token) => {
        // Keep a timed-out token out of the active query arguments. If its
        // answer arrives late, the report callback below restores this exact
        // candidate only when no newer join/leave decision has won.
        candidateTokenRef.current = token;
        try {
          const result = await convex.query(api.players.session, { sessionToken: token });
          restoreLookupResultRef.current = result === null ? 'null' : 'seat';
          return result;
        } catch (error) {
          restoreLookupResultRef.current = 'failed';
          throw error;
        }
      },
      (late) => {
        setRestoringToken(false);
        const next = resumeReportState({
          current: activeSessionRef.current,
          currentToken: activeTokenRef.current,
          candidateToken: candidateTokenRef.current,
          late,
          ignoreLateResume: ignoreLateResumeRef.current,
        });
        // Refs make the winner explicit before React batches either setter:
        // a late restore cannot race a join or deliberate leave that has
        // already updated the active seat/token in this launch.
        activeSessionRef.current = next.session;
        activeTokenRef.current = next.sessionToken;
        setSession(next.session);
        setSessionToken(next.sessionToken);

        // Only a completed room lookup that authoritatively returned null can
        // retire a stale durable token. The patience timeout also reports null,
        // but clearing at that point could erase a valid late seat's token.
        if (
          !restoreNullClearedRef.current &&
          shouldClearRestoredCredential({
            lookupResult: restoreLookupResultRef.current,
            reported: late,
            current: next.session,
            ignoreLateResume: ignoreLateResumeRef.current,
          })
        ) {
          restoreNullClearedRef.current = true;
          clearPersistedCredential();
        }
      },
      undefined,
      (status: SessionTokenStatus) => {
        if (status === 'present') {
          setRestoringToken(true);
        } else {
          // A deep-linked identity route can finish a join while SecureStore's
          // initial read is still in flight. Its late "missing" status must not
          // erase that newer seat or credential.
          if (ignoreLateResumeRef.current || (activeSessionRef.current !== undefined && activeSessionRef.current !== null)) return;
          setRestoringToken(false);
          activeSessionRef.current = null;
          activeTokenRef.current = undefined;
          setSessionToken(undefined);
          setSession(null);
        }
      },
    );
  }, [clearPersistedCredential, convex]);

  const completeJoin = useCallback((next: PlayerSession & { readonly sessionToken: string }) => {
    const { sessionToken: joinedToken, ...publicSeat } = next;
    credentialRevisionRef.current += 1;
    deliberateLeaveRef.current = false;
    ignoreLateResumeRef.current = true;
    activeSessionRef.current = publicSeat;
    activeTokenRef.current = joinedToken;
    setSessionToken(joinedToken);
    setSession(publicSeat);
    setNotice(undefined);
  }, []);

  const rememberProfile = useCallback((profile: GuestProfileV1) => {
    setRememberedProfile(profile);
  }, []);

  const beginLeave = useCallback(() => {
    deliberateLeaveRef.current = true;
  }, []);

  const cancelLeave = useCallback(() => {
    deliberateLeaveRef.current = false;
  }, []);

  const reportSeatLost = useCallback((reason: string) => {
    ignoreLateResumeRef.current = true;
    // Leave removes the seat on the server before local storage finishes
    // clearing. Suppress that expected subscription update rather than
    // showing a false host-removal or closed-room notice.
    if (deliberateLeaveRef.current) {
      credentialRevisionRef.current += 1;
      activeSessionRef.current = null;
      activeTokenRef.current = undefined;
      setSession(null);
      setSessionToken(undefined);
      return;
    }
    credentialRevisionRef.current += 1;
    setNotice(reason);
    activeSessionRef.current = null;
    activeTokenRef.current = undefined;
    setSession(null);
    setSessionToken(undefined);
    clearPersistedCredential();
  }, [clearPersistedCredential]);

  const leave = useCallback(async () => {
    credentialRevisionRef.current += 1;
    deliberateLeaveRef.current = true;
    ignoreLateResumeRef.current = true;
    activeSessionRef.current = null;
    activeTokenRef.current = undefined;
    await forgetSession(phoneSessionTokenStore);
    setNotice(undefined);
    setSession(null);
    setSessionToken(undefined);
  }, []);

  const clearNotice = useCallback(() => setNotice(undefined), []);
  const value = useMemo<PhoneSessionContextValue>(() => ({
    session,
    seat: session,
    sessionToken,
    restoringToken,
    notice,
    rememberedProfile,
    completeJoin,
    rememberProfile,
    beginLeave,
    cancelLeave,
    reportSeatLost,
    leave,
    clearNotice,
  }), [beginLeave, cancelLeave, clearNotice, completeJoin, leave, notice, rememberProfile, rememberedProfile, reportSeatLost, restoringToken, session, sessionToken]);

  return <PhoneSessionContext.Provider value={value}>{children}</PhoneSessionContext.Provider>;
}

export function usePhoneSession(): PhoneSessionContextValue {
  const value = useContext(PhoneSessionContext);
  if (value === null) throw new Error('usePhoneSession must be used inside PhoneSessionProvider');
  return value;
}
