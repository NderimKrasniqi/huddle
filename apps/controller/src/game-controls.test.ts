import type { RosterSeatForGame } from '@huddle/game-core';
import { GAME_REGISTRY } from '@huddle/game-registry';
import { describe, expect, it } from 'vitest';

import {
  BACK_TO_ROOM,
  backToLobbyLabel,
  CHOOSE_A_GAME,
  gameToStart,
  hostChoosingLine,
  leaveConsequence,
  LEAVE_ROOM,
  NOW_VIEWING_CAPTION,
  nowViewingLine,
  startControl,
} from './game-controls';

/** The installed game these tests read their expectations off. */
const installed = GAME_REGISTRY[0]!.metadata;

function party(size: number): RosterSeatForGame[] {
  return Array.from({ length: size }, (_unused, index) => ({
    playerId: `p${index}`,
    nickname: `Player ${index}`,
    away: false,
    host: index === 0,
    avatar: 'fox' as const,
  }));
}

describe('the game the Host would start', () => {
  it('is the one the Registry installs', () => {
    // Not "trivia": the phone reads the Registry, and naming a game here is the
    // thing the whole interface exists to avoid.
    expect(gameToStart(0)).toBe(GAME_REGISTRY[0]?.metadata);
  });
});

describe('the Host’s start control', () => {
  it('offers the installed game by name', () => {
    const control = startControl(party(2), 0);

    expect(control.label).toBe(`Select ${GAME_REGISTRY[0]?.metadata.title}`);
    expect(control.enabled).toBe(true);
    expect(control.blockedBecause).toBeUndefined();
  });

  it('waits, and says what it is waiting for, one player short', () => {
    const control = startControl(party(1), 0);

    expect(control.enabled).toBe(false);
    // Singular, because "needs 1 more players" is what a machine says.
    expect(control.blockedBecause).toBe(`${GAME_REGISTRY[0]?.metadata.title} needs one more player.`);
  });

  it('counts how many more are needed when it is more than one', () => {
    // No installed game needs three today; the wording is what is being pinned,
    // and it has to be right the first time a game does.
    const control = startControl([], 0);
    const need = GAME_REGISTRY[0]?.metadata.playerRange.min ?? 0;

    expect(control.enabled).toBe(false);
    expect(control.blockedBecause).toBe(
      `${GAME_REGISTRY[0]?.metadata.title} needs ${need} more players.`,
    );
  });

  it('still names the game it is waiting to start', () => {
    // The label does not become "Waiting…": the Host should see what the button
    // will do once the room fills, not lose it while the room is short.
    expect(startControl(party(1), 0).label).toBe(`Select ${GAME_REGISTRY[0]?.metadata.title}`);
  });

  it('counts an away player, since the room still seats them', () => {
    const withOneAway: RosterSeatForGame[] = [
      { playerId: 'p0', nickname: 'Ada', away: false, host: true, avatar: 'fox'  },
      { playerId: 'p1', nickname: 'Grace', away: true, host: false, avatar: 'fox'  },
    ];

    // The same count `startGame` uses — excluding away players is Phase 4's
    // "Away players in-game", and the two must not disagree before then.
    expect(startControl(withOneAway, 0).enabled).toBe(true);
  });
});

describe('what a player who is not running the room is told', () => {
  it('names the card the room is looking at', () => {
    expect(nowViewingLine(installed)).toBe(`Now viewing ${installed.title}`);
  });

  it('says what their phone is about to become (handoff §8)', () => {
    // The handoff's own caption, word for word: it is the whole answer to
    // "there is nothing to press here", which is what this screen looks like.
    expect(NOW_VIEWING_CAPTION).toBe(
      'Your phone becomes the controller for the game on the TV.',
    );
  });
});

describe('the Host’s way back to the lobby', () => {
  it('says where it goes rather than what it ends', () => {
    // One label for every beat of every game, because the hub never reads a
    // game's state and so cannot know which beat the room is on. "End game" is
    // false on the beat after a game has ended; this is true on all of them.
    expect(backToLobbyLabel(false)).toBe('Back to lobby');
  });

  it('says the room is on its way while the tap is in flight', () => {
    expect(backToLobbyLabel(true)).toBe('Returning…');
  });
});

describe('leaving the room', () => {
  it('is a different act from “Back to lobby”, and says so', () => {
    // The two sit one tap apart on the Host's screens and do opposite things:
    // one ends a game and keeps every seat, the other gives up a seat and keeps
    // the game. Labels that read alike would be the wrong one tapped.
    expect(LEAVE_ROOM.label).not.toBe(backToLobbyLabel(false));
  });

  it('warns the last player out that the room goes with them', () => {
    // The only irreversible case, and the only one that costs anybody else
    // anything — because there is nobody else.
    const alone = leaveConsequence(1, true);

    expect(alone).toContain('room closes');
    expect(alone).toContain('code stops working');
  });

  it('treats an empty roster as the last player out', () => {
    // A count of zero is a roster that has not landed rather than a room with
    // nobody in it — the reader is in it. The cautious sentence is the right
    // one to show while the phone does not know.
    expect(leaveConsequence(0, false)).toBe(leaveConsequence(1, false));
  });

  it('tells a departing Host the room carries on without them', () => {
    // `handOverRoom` picks the successor, so the room does not end — which is
    // the whole difference from the End room this replaced.
    const host = leaveConsequence(4, true);

    expect(host).toContain('takes over');
    expect(host).toContain('rejoin');
  });

  it('promises a successor, which the backend always keeps', () => {
    // `handOverRoom` hands a leaver's room to the longest-connected remaining
    // seat even when the room is not currently hearing from it, so there is no
    // "nobody to take over" case left for this to describe. See its
    // `departingIsLeaving` argument.
    expect(leaveConsequence(4, true)).toContain('takes over');
  });

  it('tells everybody else they are only giving up a seat', () => {
    const player = leaveConsequence(4, false);

    expect(player).toContain('rejoin');
    expect(player).not.toContain('closes');
  });
});

describe('what the Host is waiting on, told to everybody else', () => {
  it('names the Host, because the screen is about them', () => {
    expect(hostChoosingLine('Sam')).toBe('Sam is choosing…');
  });

  it('says something true while there is no name to say', () => {
    // The roster has not landed. Naming a host this phone has not been told
    // about is the one thing this line must not do, and a blank where a name
    // goes would move the rest of the screen when it arrived.
    expect(hostChoosingLine(undefined)).toBe('Choosing a game…');
  });
});

describe('the Host’s two ways between their room and the picker', () => {
  it('offers the picker without committing anything', () => {
    // The arrow on this one is drawn by the button, not written here: every
    // other primary in the product commits something and carries no arrow.
    expect(CHOOSE_A_GAME).toBe('Choose a game');
  });

  it('names where the way back goes, rather than calling itself a cancel', () => {
    // Browsing is already shared with the room and the television, so backing
    // out of the picker discards nothing there is a word for.
    expect(BACK_TO_ROOM).toBe('Your room');
  });
});
