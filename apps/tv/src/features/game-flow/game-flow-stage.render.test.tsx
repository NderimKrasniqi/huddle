import { act, cleanup, render, screen } from '@testing-library/react-native';

import type { RosterSeat } from '../../models';
import { TvGameFlowStage, type TvGameSetupProjection } from './game-flow-stage';

const roster: readonly RosterSeat[] = [
  {
    playerId: 'ada' as RosterSeat['playerId'],
    nickname: 'Ada',
    avatar: 'fox',
    away: false,
    host: true,
  },
  {
    playerId: 'bo' as RosterSeat['playerId'],
    nickname: 'Bo',
    avatar: 'teal-bear',
    away: false,
    host: false,
  },
];

const setup: TvGameSetupProjection = {
  gameId: 'trivia',
  settings: { questions: '10' },
  mode: 'standard',
  stage: 'configuring',
  readyPlayerIds: [],
};

describe('TvGameFlowStage', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('routes a browsed room to the illustrated carousel', async () => {
    await render(
      <TvGameFlowStage browsingAt={0} setup={null} roster={roster} reduceMotion />,
    );

    expect(screen.getByTestId('tv-game-carousel')).toBeTruthy();
    expect(screen.getByLabelText('Ada is choosing a game')).toBeTruthy();
  });

  it('plays the selection reveal once, then returns to setup', async () => {
    jest.useFakeTimers();
    const rendered = await render(
      <TvGameFlowStage browsingAt={0} setup={null} roster={roster} />,
    );

    await act(async () => {
      rendered.rerender(
        <TvGameFlowStage browsingAt={0} setup={setup} roster={roster} />,
      );
    });
    expect(screen.getByTestId('tv-selected-game-art')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(screen.getByTestId('tv-game-setup')).toBeTruthy();

    await act(async () => {
      rendered.rerender(
        <TvGameFlowStage browsingAt={0} setup={null} roster={roster} />,
      );
    });
    expect(screen.getByTestId('tv-game-carousel')).toBeTruthy();
    await act(async () => {
      rendered.rerender(
        <TvGameFlowStage browsingAt={0} setup={setup} roster={roster} />,
      );
    });
    expect(screen.getByTestId('tv-selected-game-art')).toBeTruthy();
  });

  it('shows the ready surface only after every current player is ready', async () => {
    await render(
      <TvGameFlowStage
        browsingAt={0}
        setup={{ ...setup, stage: 'ready', readyPlayerIds: ['ada', 'bo'] }}
        roster={roster}
        roomCode="KWRD"
        reduceMotion
      />,
    );

    expect(screen.getByTestId('tv-game-ready')).toBeTruthy();
    expect(screen.getByText('Everyone is ready!')).toBeTruthy();
    expect(screen.getByText('Room KWRD')).toBeTruthy();
  });
});
