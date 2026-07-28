import { describe, expect, it } from 'vitest';

import type {
  GameMetadata,
  GameModule,
  GamePlayer,
  GameRegistry,
  TvGameScreenProps,
} from './game-module';

/**
 * The interface's test is a *compile-time* one: it builds a game that does not
 * exist against the interface, and the assertion is that `tsc` accepts it —
 * with `@ts-expect-error` on each violation, so a slackened interface fails the
 * typecheck instead of passing it quietly. The runtime `expect`s below are
 * there because a type has to be reachable from somewhere the test runner will
 * load; the checking that matters happened before any of them ran.
 *
 * Coin Toss is deliberately nothing like trivia — different state, different
 * event, different settings — because the promise being tested is that the
 * interface fits a game nobody has thought of yet (docs/project-scope.md: the
 * hub must take a game #2 with no changes of its own).
 */

type CoinTossState = {
  readonly tossesLeft: number;
  readonly calls: Readonly<Record<string, 'heads' | 'tails'>>;
};

type CoinTossEvent = {
  readonly playerId: string;
  readonly call: 'heads' | 'tails';
};

type CoinTossSettings = {
  readonly tosses: '1' | '3';
};

const coinToss: GameModule<CoinTossState, CoinTossEvent, CoinTossSettings> = {
  metadata: {
    id: 'coin-toss',
    title: 'Coin Toss',
    keyArt: { color: 'yellow' },
    playerRange: { min: 2, max: 10 },
    estimatedMinutes: 1,
    category: 'Chance',
  },
  settingsSchema: [
    {
      key: 'tosses',
      label: 'Tosses',
      options: [
        { value: '1', label: 'One' },
        { value: '3', label: 'Three' },
      ],
      defaultValue: '1',
    },
  ],
  createInitialState: ({ settings }) => ({ tossesLeft: Number(settings.tosses), calls: {} }),
  reduce: (state, event) => ({
    ...state,
    calls: { ...state.calls, [event.playerId]: event.call },
  }),
  screens: {
    tv: () => null,
    controller: () => null,
  },
};

function player(playerId: string, nickname: string): GamePlayer {
  return { playerId, nickname, away: false };
}

describe('the Game Module interface', () => {
  it('takes a game the hub knows nothing about', () => {
    const state = coinToss.createInitialState({
      players: [player('p1', 'Ada'), player('p2', 'Grace')],
      settings: { tosses: '3' },
    });

    expect(coinToss.reduce(state, { playerId: 'p1', call: 'heads' })).toEqual({
      tossesLeft: 3,
      calls: { p1: 'heads' },
    });
  });

  it('holds games of unrelated shapes in one registry', () => {
    const registry: GameRegistry = [coinToss];

    expect(registry.map((game) => game.metadata.id)).toEqual(['coin-toss']);
  });

  it('lets the hub render a registry entry without knowing its state', () => {
    const [game] = [coinToss] as GameRegistry;

    // What the hub does with a game it cannot name: hand the screen the state
    // it is holding for that game, opaque all the way through.
    expect(game?.screens.tv({ state: {}, players: [] })).toBeNull();
  });

  it('rejects a game that leaves out part of its metadata', () => {
    // @ts-expect-error - a game the hub cannot say the length of is not renderable
    const metadata: GameMetadata = {
      id: 'coin-toss',
      title: 'Coin Toss',
      keyArt: { color: 'yellow' },
      playerRange: { min: 2, max: 10 },
      category: 'Chance',
    };

    expect(metadata.title).toBe('Coin Toss');
  });

  it('rejects key art in a color Boardwalk cannot draw', () => {
    const keyArt: GameMetadata['keyArt'] = {
      // @ts-expect-error - chartreuse is not one of KEY_ART_COLOR_NAMES
      color: 'chartreuse',
    };

    expect(keyArt).toBeDefined();
  });

  it('rejects an event that does not say which player it came from', () => {
    // @ts-expect-error - Event must extend GameEvent
    const anonymous: GameModule<CoinTossState, { readonly call: 'heads' }> | null = null;

    expect(anonymous).toBeNull();
  });

  it('rejects a reducer that returns something other than the game state', () => {
    const drifting: GameModule<CoinTossState, CoinTossEvent, CoinTossSettings> = {
      ...coinToss,
      // @ts-expect-error - a reducer returns the next state, not a fresh shape
      reduce: () => ({ flips: 1 }),
    };

    expect(drifting.metadata.id).toBe('coin-toss');
  });

  it('rejects a screen that draws a state its own game never produces', () => {
    const mismatched: GameModule<CoinTossState, CoinTossEvent, CoinTossSettings> = {
      ...coinToss,
      screens: {
        // @ts-expect-error - the TV screen is handed this game's state, no other
        tv: (props: TvGameScreenProps<{ readonly deck: string }>) => props.state.deck,
        controller: () => null,
      },
    };

    expect(mismatched.metadata.id).toBe('coin-toss');
  });
});
