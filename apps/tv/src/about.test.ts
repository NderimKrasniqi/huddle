import { describe, expect, it } from 'vitest';

import { ABOUT_PANEL_KEY, aboutLines, aboutPanelAfter, type BuildStamp } from './about';

/** A build with nothing interesting about it, for the fields a case is not about. */
const A_BUILD: BuildStamp = {
  version: '0.1.0',
  debug: false,
  deploymentUrl: 'https://cheerful-otter-123.convex.cloud',
  gameIds: ['trivia'],
};

/** What the panel says under `label`, for the one line a case is about. */
function line(build: Partial<BuildStamp>, label: string): string | undefined {
  return aboutLines({ ...A_BUILD, ...build }).find((row) => row.label === label)?.value;
}

describe('the About Panel and the remote', () => {
  it('opens on the one key the app listens for', () => {
    expect(aboutPanelAfter(false, { eventType: ABOUT_PANEL_KEY })).toBe(true);
  });

  // The whole first half of the criterion, as a table: a remote pressed at a
  // television that is running a party does nothing at all. `select` is in the
  // list on purpose — the OK button *does* reach this module on both platforms
  // (see `./about`), so "nothing happens" has to be this function's answer
  // rather than a fact about what the platform delivers.
  it.each([
    'up',
    'down',
    'left',
    'right',
    'select',
    'longSelect',
    'menu',
    'swipeUp',
    'swipeDown',
    'pan',
    'pageUp',
    'fastForward',
  ])('is not opened by %s', (eventType) => {
    expect(aboutPanelAfter(false, { eventType })).toBe(false);
  });

  // A panel a remote can put up and cannot take down would be the one state
  // this television could get stuck in, so everything takes it down — including
  // the key that put it there, and including OK, which is the button somebody
  // who wants the panel gone will reach for first.
  it.each([ABOUT_PANEL_KEY, 'up', 'select', 'menu', 'pan'])('is closed again by %s', (eventType) => {
    expect(aboutPanelAfter(true, { eventType })).toBe(false);
  });

  // Android reports a press twice, as its key going down and coming back up;
  // tvOS reports the tap once, on the way up. Acting on the release is what
  // makes one press one press on both — otherwise a single Android play/pause
  // would open the panel and immediately close it.
  it('acts on a press being released and not on it being made', () => {
    expect(aboutPanelAfter(false, { eventType: ABOUT_PANEL_KEY, eventKeyAction: 0 })).toBe(false);
    expect(aboutPanelAfter(false, { eventType: ABOUT_PANEL_KEY, eventKeyAction: 1 })).toBe(true);
    expect(aboutPanelAfter(true, { eventType: 'up', eventKeyAction: 0 })).toBe(true);
    expect(aboutPanelAfter(true, { eventType: 'up', eventKeyAction: 1 })).toBe(false);
  });

  // tvOS taps report `1`; a swipe or a pan reports no action at all, and the
  // emitter's own "unknown" is -1. None of those is a key going down.
  it.each([undefined, -1, 1])('treats a key action of %s as a press', (eventKeyAction) => {
    expect(aboutPanelAfter(false, { eventType: ABOUT_PANEL_KEY, eventKeyAction })).toBe(true);
  });
});

describe('what the About Panel says', () => {
  it('identifies the build, the room server and the games, in that order', () => {
    expect(aboutLines(A_BUILD)).toEqual([
      { label: 'VERSION', value: '0.1.0' },
      { label: 'ROOM SERVER', value: 'cheerful-otter-123.convex.cloud' },
      { label: 'GAMES', value: 'trivia' },
    ]);
  });

  it('marks a debug build, which is the one that dies when a laptop leaves', () => {
    expect(line({ debug: true }, 'VERSION')).toBe('0.1.0 (debug)');
  });

  it('says so rather than guessing when the build carries no version', () => {
    expect(line({ version: undefined }, 'VERSION')).toBe('unknown');
    expect(line({ version: undefined, debug: true }, 'VERSION')).toBe('unknown (debug)');
  });

  // The host and not the whole URL: which deployment a television is on is the
  // question, and the scheme is the same on every answer.
  it.each([
    ['https://cheerful-otter-123.convex.cloud', 'cheerful-otter-123.convex.cloud'],
    ['https://cheerful-otter-123.convex.cloud/', 'cheerful-otter-123.convex.cloud'],
    ['http://127.0.0.1:3210', '127.0.0.1:3210'],
    ['ws://192.168.1.14:3210/api/sync', '192.168.1.14:3210'],
  ])('reads the room server off %s', (deploymentUrl, host) => {
    expect(line({ deploymentUrl }, 'ROOM SERVER')).toBe(host);
  });

  // A URL that is not one is exactly what somebody reading this panel needs to
  // see, so it is shown as it was written rather than tidied into nothing.
  it('shows a deployment URL it cannot read as it stands', () => {
    expect(line({ deploymentUrl: 'convex.cloud oops' }, 'ROOM SERVER')).toBe('convex.cloud oops');
  });

  it('says when the build was given no deployment at all', () => {
    expect(line({ deploymentUrl: undefined }, 'ROOM SERVER')).toBe('not configured');
    expect(line({ deploymentUrl: '' }, 'ROOM SERVER')).toBe('not configured');
  });

  // What this television can draw when a room starts one — the fact behind the
  // "this room is playing X, which this TV doesn't have yet" screen.
  it('lists the games installed on this television', () => {
    expect(line({ gameIds: ['trivia', 'doodle'] }, 'GAMES')).toBe('trivia, doodle');
    expect(line({ gameIds: [] }, 'GAMES')).toBe('none installed');
  });
});
