import { existsSync, readFileSync } from 'node:fs';
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

describe('the Controller route a Join Link opens', () => {
  /** A Join Link's path, as expo-router resolves it: the part after the scheme. */
  function joinLinkPath(code: string): string[] {
    return roomJoinLink(code).slice(`${JOIN_LINK_SCHEME}://`.length).split('/');
  }

  // The other half of the scheme check above. Claiming the scheme only gets the
  // link as far as the app; what turns it into the join screen is expo-router
  // matching the link's path against a file in `apps/controller/app`. Nothing
  // in TypeScript connects the string this module builds to that filename, so a
  // renamed route would go on typechecking while every QR in the house stopped
  // opening anything.
  it('is a file expo-router will resolve the link to', () => {
    const linkPath = joinLinkPath('KWRD');
    // The code is the last segment and the dynamic one; everything before it is
    // the static path, and so the directories the route file sits in.
    const routeDir = linkPath.slice(0, -1);

    expect(linkPath.at(-1)).toBe('KWRD');
    // The dynamic file is named for its param — `code`, which is what the join
    // screen reads off `useLocalSearchParams`.
    expect(
      existsSync(path.join(appsDir, 'controller', 'app', ...routeDir, '[code].tsx')),
    ).toBe(true);
  });
});
