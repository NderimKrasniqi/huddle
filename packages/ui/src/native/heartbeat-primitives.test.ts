import { describe, expect, it, vi } from 'vitest';

import {
  AvatarPortrait,
  Badge,
  Chip,
  CodeTiles,
  GameCard,
  HuddleButton,
  PlayerRow,
  StatusSurface,
} from './index';

// The package's unit runner uses a minimal React Native stub. Replace its host
// values here so the test can inspect the shared component contract without
// requiring a native renderer or adding a second UI test harness to @huddle/ui.
vi.mock('react-native', () => ({
  AccessibilityInfo: {},
  ActivityIndicator: 'ActivityIndicator',
  Animated: { Image: 'Animated.Image', View: 'Animated.View' },
  Image: 'Image',
  Platform: { select: (options: Record<string, unknown>) => options.default ?? options.ios },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

type HostNode = {
  readonly type: string;
  readonly props: Record<string, unknown>;
};

function hostNodes(value: unknown): HostNode[] {
  if (Array.isArray(value)) return value.flatMap(hostNodes);
  if (value === null || typeof value !== 'object') return [];

  const element = value as {
    readonly type: unknown;
    readonly props: Record<string, unknown>;
  };
  if (typeof element.type === 'function') {
    return hostNodes(element.type(element.props));
  }
  if (typeof element.type !== 'string') return [];

  return [
    { type: element.type, props: element.props },
    ...hostNodes(element.props.children),
  ];
}

describe('Heartbeat native primitives', () => {
  it('keeps passive TV surfaces outside the focus and press order', () => {
    const passiveButton = HuddleButton({
      title: 'Start game',
      interactive: false,
      testID: 'passive-button',
    });
    const passiveChip = Chip({ label: 'Trivia', testID: 'passive-chip' });
    const passiveCode = CodeTiles({ code: '7K2D', testID: 'passive-code' });
    const passiveCard = GameCard({
      title: 'Quick Poll',
      description: 'A fast group pulse check',
      metadata: ['3–10 players', '5 min'],
      image: 1,
      comingSoon: true,
      interactive: false,
      testID: 'passive-card',
    });
    const passiveRow = hostNodes(
      PlayerRow({
        displayName: 'Milo',
        avatarId: 'fox',
        status: 'ready',
        isHost: true,
        testID: 'passive-row',
      }),
    );
    const passiveAvatar = AvatarPortrait({
      avatarId: 'fox',
      displayName: 'Milo',
      testID: 'passive-avatar',
    });
    const passiveBadge = Badge({
      label: 'Ready',
      tone: 'ready',
      testID: 'passive-badge',
    });
    const tvStatus = hostNodes(
      StatusSurface({
        platform: 'tv',
        variant: 'info',
        title: 'TV setup required',
        message: 'Connect the Huddle TV app to continue',
        testID: 'passive-status',
      }),
    );

    expect(passiveButton).toMatchObject({
      type: 'View',
      props: { focusable: false, pointerEvents: 'none' },
    });
    expect(passiveChip).toMatchObject({
      type: 'View',
      props: { focusable: false, pointerEvents: 'none' },
    });
    expect(passiveCode).toMatchObject({
      type: 'View',
      props: { focusable: false, pointerEvents: 'none' },
    });
    expect(passiveCard).toMatchObject({
      type: 'View',
      props: { focusable: false, pointerEvents: 'none' },
    });
    expect(passiveAvatar).toMatchObject({
      type: 'View',
      props: { focusable: false },
    });
    expect(passiveBadge).toMatchObject({
      type: 'View',
      props: { accessible: true, focusable: false, accessibilityLabel: 'Ready' },
    });
    expect(passiveRow.find((node) => node.props.testID === 'passive-row')).toMatchObject({
      type: 'View',
      props: { focusable: false },
    });
    expect(passiveRow.some((node) => node.type === 'Pressable')).toBe(false);
    expect(passiveRow
      .filter((node) => node.props.accessible === true)
      .every((node) => node.props.focusable === false))
      .toBe(true);
    expect(tvStatus.find((node) => node.props.testID === 'passive-status')).toMatchObject({
      type: 'View',
      props: { focusable: false },
    });
    expect(tvStatus.find((node) => node.props.testID === 'passive-status-announcement')).toMatchObject({
      type: 'View',
      props: { focusable: false },
    });
    expect(tvStatus.some((node) => node.type === 'Pressable')).toBe(false);
  });

  it('keeps Phone recovery actions reachable and preserves grouped card announcements', () => {
    const phoneStatus = hostNodes(
      StatusSurface({
        platform: 'phone',
        variant: 'error',
        title: 'Room unavailable',
        message: 'Try another room code',
        action: { label: 'Try again', onPress: vi.fn() },
      }),
    );
    const recoveryAction = phoneStatus.find(
      (node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Try again',
    );
    const card = GameCard({
      title: 'Trivia',
      description: 'Test your group knowledge',
      metadata: ['2–8 players', '15 min'],
      image: 1,
      selected: true,
      interactive: false,
    });

    expect(recoveryAction).toBeDefined();
    expect(recoveryAction?.props.focusable).not.toBe(false);
    expect(card).toMatchObject({
      props: {
        accessibilityLabel: 'Trivia. Selected. Test your group knowledge. 2–8 players, 15 min',
      },
    });
  });
});
