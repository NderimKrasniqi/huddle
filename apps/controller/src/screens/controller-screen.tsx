import { api } from '@huddle/convex';
import { AnimatedScreen } from '@huddle/ui/native';
import { useConvex } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { JoinForm } from '../features/join/native';
import { SeatedController } from './seated-controller';
import { joinScreenState, type PlayerSession, phoneSessionTokenStore, resumeSession } from '../platform/session';
import { PhoneLoadingScreen } from '../ui/native';

export default function ControllerScreen() {
  // The code a scanned Join Link brought with it, if the phone arrived that way
  // (`app/join/[code].tsx`). It is the only difference a scanned join makes —
  // the nickname is still typed.
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const convex = useConvex();

  // The seat this phone already holds: `undefined` while its Session Token and
  // the room are still being asked, `null` once the answer is that it holds
  // none. A player who force-quit mid-party is nobody's new arrival, so the
  // join form is what this screen falls back to rather than what it opens with.
  const [session, setSession] = useState<PlayerSession | null>();

  // Why the phone is on the join form, when it landed there by losing a seat
  // rather than by never having one. Carried from the seated screen to the form
  // so a removed player is told they were removed instead of finding themselves
  // inexplicably back at the start. `undefined` on an ordinary launch.
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    // Safe on every mount, unlike the TV's `openRoom`: rejoining reads, so a
    // remount asks the same question again instead of taking a second seat.
    // It may answer twice — a bounded blank screen first, the room's real word
    // whenever it lands (see `resumeSession`) — and this state takes both.
    return resumeSession(
      phoneSessionTokenStore,
      (sessionToken) => convex.query(api.players.session, { sessionToken }),
      // A late answer fills a blank, and never overwrites a seat. Between the
      // deadline and the room finally answering, the player may have joined
      // somewhere else — and the room they are in now beats the one they were
      // in then, whichever order the two arrive in.
      (late) => setSession((current) => current ?? late),
    );
  }, [convex]);

  // A scanned Join Link starting a fresh form is a fresh context: a seat-loss
  // notice about the room this phone just left has nothing to say about the room
  // a new link names, so it is dropped the moment the link changes rather than
  // riding along to it. Adjusted during render — React's own way to reset state
  // when an input changes — since the notice belongs to the code it arrived on.
  const [noticeLink, setNoticeLink] = useState(linkedCode);
  if (noticeLink !== linkedCode) {
    setNoticeLink(linkedCode);
    setNotice(undefined);
  }

  const state = joinScreenState(session, linkedCode ?? '');

  if (state.kind === 'restoring') {
    // Do not draw the Join form while an existing seat may still be on its way.
    // `resumeSession` bounds this state, and the branded recovery surface says
    // what the formerly blank phone is doing meanwhile.
    return <PhoneLoadingScreen phase="restoring" />;
  }

  if (state.kind === 'seated') {
    // A seat can end without this phone doing anything: the Host removes this
    // player, or the room expires after its TV has stayed away.
    // Forgetting the seat here is what sends the phone back to the form — the
    // screen below watches the room for it.
    return (
      <AnimatedScreen key={`seated-${state.session.playerId}`}>
        <SeatedController
          session={state.session}
          onSeatLost={(reason) => {
            setNotice(reason);
            setSession(null);
          }}
          // No notice. A phone that tapped Leave knows why it is here, and
          // `seatLossNotice` has no true sentence for a departure nobody imposed.
          onLeft={() => setSession(null)}
        />
      </AnimatedScreen>
    );
  }

  // Keyed by the link so a second Join Link scanned while this screen is
  // already open starts the form over on the room it names, rather than leaving
  // the first room's code in tiles the player thinks they just replaced — which
  // covers the phone that already holds a seat and has just scanned another
  // room's TV, since `joinScreenState` sends that scan here. A typed join has
  // no link and so a constant key: nothing remounts under somebody's thumbs.
  return (
    <AnimatedScreen key={`join-${linkedCode ?? ''}`}>
      <JoinForm
        key={linkedCode ?? ''}
        linkedCode={linkedCode ?? ''}
        onSeated={setSession}
        notice={notice}
      />
    </AnimatedScreen>
  );
}
