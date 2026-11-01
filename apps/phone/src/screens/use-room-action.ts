import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { lifecycleFailureMessage } from '../models/lifecycle-rejection';

export type BusyAction =
  | 'leave'
  | 'transfer'
  | 'remove'
  | 'browse'
  | 'select'
  | 'configure'
  | 'finalize'
  | 'reopen'
  | 'cancel'
  | 'ready'
  | 'start'
  | 'stop'
  | 'end'
  | 'continue'
  | 'event'
  | null;

export type Confirmation = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly action: Exclude<BusyAction, null>;
  readonly onConfirm: () => void;
};

export type RoomAction = ReturnType<typeof useRoomAction>;

const SUCCESS_MS = 2600;

export function useRoomAction(token: string | undefined) {
  const [busy, setBusy] = useState<BusyAction>(null);
  const [failure, setFailure] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  useFocusEffect(useCallback(() => () => setConfirmation(undefined), []));
  const busyRef = useRef<BusyAction>(null);

  useEffect(() => {
    if (success === undefined) return;
    const timeout = setTimeout(() => setSuccess(undefined), SUCCESS_MS);
    return () => clearTimeout(timeout);
  }, [success]);

  async function run(action: Exclude<BusyAction, null>, callback: () => Promise<unknown>, message = lifecycleFailureMessage) {
    if (busyRef.current !== null || token === undefined) return false;
    busyRef.current = action;
    setBusy(action);
    setFailure(undefined);
    setSuccess(undefined);
    try {
      await callback();
      return true;
    } catch (error) {
      setFailure(message(error));
      return false;
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }

  function confirm(next: Confirmation) {
    setFailure(undefined);
    setConfirmation(next);
  }

  return { busy, failure, success, confirmation, run, confirm, setFailure, setSuccess, dismissConfirmation: () => setConfirmation(undefined) };
}
