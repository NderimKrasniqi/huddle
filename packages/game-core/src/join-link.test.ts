import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { JOIN_LINK_SCHEME, roomJoinLink } from './join-link';
import { generateRoomCode, ROOM_CODE_LENGTH } from './room-code';

const appsDir = path.join(import.meta.dirname, '..', '..', '..', 'apps');

/** The `expo.scheme` an app registers with the OS, read from its Expo config. */
function registeredScheme(app: string): unknown {
  const config: unknown = JSON.parse(
    readFileSync(path.join(appsDir, app, 'app.json'), 'utf8'),
  );
  return (config as { expo: { scheme: unknown } }).expo.scheme;
}

describe('roomJoinLink', () => {
  it('builds the deep link the QR encodes', () => {
    expect(roomJoinLink('KWRD')).toBe('huddle://join/KWRD');
  });

  it('carries the code of any room it is given', () => {
    const code = generateRoomCode();
    expect(roomJoinLink(code)).toBe(`huddle://join/${code}`);
    expect(roomJoinLink(code)).toHaveLength(
      'huddle://join/'.length + ROOM_CODE_LENGTH,
    );
  });
});

describe('JOIN_LINK_SCHEME', () => {
  // A Join Link with a scheme no app claims opens nothing at all, and neither
  // typecheck nor lint can see across into an Expo config.
  it.each(['tv', 'controller'])('is the scheme the %s app registers', (app) => {
    expect(registeredScheme(app)).toBe(JOIN_LINK_SCHEME);
  });
});
