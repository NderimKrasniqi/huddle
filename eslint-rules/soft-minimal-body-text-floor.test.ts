import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { minBodyFontSize } from '@huddle/ui';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * `soft-minimal/body-text-floor` exercised through ESLint itself, against the
 * repo's real `eslint.config.js`, rather than through `RuleTester` — for the
 * reason its sibling's test gives, and for one more of its own.
 *
 * This gate is *half config*: the rule knows what a floor is, and the flat
 * config knows which surface a file stands on. A `RuleTester` would pin the
 * arithmetic and stay green through a config that pointed the floor at no files
 * at all, or at the phone with the television's number on it. So every sample
 * below is linted at a real path, and the paths are the assertion as much as
 * the code is.
 */

const RULE = 'soft-minimal/body-text-floor';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trim();

/** The four file sets the floor is switched on for: two on each surface. */
const A_TV_SCREEN = path.join(repoRoot, 'apps/tv/app/body-text-floor-probe.tsx');
const A_TRIVIA_TV_SCREEN = path.join(
  repoRoot,
  'games/trivia/src/tv-body-text-floor-probe.tsx',
);
const A_CONTROLLER_SCREEN = path.join(repoRoot, 'apps/phone/app/body-text-floor-probe.tsx');
const A_TRIVIA_CONTROLLER_SCREEN = path.join(
  repoRoot,
  'games/trivia/src/phone-body-text-floor-probe.tsx',
);

/** And a file on neither, which no floor governs. */
const A_SHARED_SOURCE = path.join(repoRoot, 'packages/contracts/src/body-text-floor-probe.ts');

const TV_APP_SCREENS = path.join(repoRoot, 'apps/tv/app');
const CONTROLLER_SCREENS = path.join(repoRoot, 'apps/phone/app');
const CONTROLLER_SOURCES = path.join(repoRoot, 'apps/phone/src');
const TRIVIA_SOURCES = path.join(repoRoot, 'games/trivia/src');

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

/** What the rule says about `code`, and nothing about what any other rule says. */
async function complaints(code: string, filePath = A_TV_SCREEN): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });

  // An ignored path lints to nothing at all, which would let every "no
  // complaints" expectation below pass without the rule ever having run.
  if (result === undefined) {
    throw new Error(`ESLint returned no result for ${filePath}; is the path ignored?`);
  }

  return result.messages
    .filter((message) => message.ruleId === RULE)
    .map((message) => message.message);
}

/** A screen that imports the theme, so the samples below can reference tokens. */
function screen(body: string): string {
  return [
    "import { fontFamily, minBodyFontSize } from '@huddle/ui';",
    "import { StyleSheet, Text, View } from 'react-native';",
    '',
    body,
    '',
  ].join('\n');
}

/** A `StyleSheet.create` block holding `declarations`. */
function styles(declarations: string): string {
  return screen(`export const styles = StyleSheet.create({ probe: { ${declarations} } });`);
}

describe('the floor the config hands the rule', () => {
  it("is Soft Minimal's own, so the two cannot drift apart", async () => {
    for (const [filePath, surface] of [
      [A_TV_SCREEN, 'tv'],
      [A_TRIVIA_TV_SCREEN, 'tv'],
      [A_CONTROLLER_SCREEN, 'phone'],
      [A_TRIVIA_CONTROLLER_SCREEN, 'phone'],
    ] as const) {
      const config = await eslint.calculateConfigForFile(filePath);
      const [severity, options] = config.rules[RULE] as [number, { surface: string }];

      expect(severity).toBe(2);
      // The whole table on both surfaces, not each surface's own number: it is
      // what lets the rule read `minBodyFontSize.phone` written on a television.
      expect(options).toEqual({ surface, minBodyFontSize });
    }
  });

  // Two blocks, and the second must not have quietly widened the first. A file
  // on neither surface is governed by no floor at all.
  it('reaches neither surface from a package both of them import', async () => {
    const config = await eslint.calculateConfigForFile(A_SHARED_SOURCE);

    expect(config.rules[RULE]).toBeUndefined();
  });
});

/** Every `.tsx` under `directory`, as a lintable absolute path. */
function screensIn(directory: string): string[] {
  return readdirSync(directory, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => path.join(directory, file));
}

/** What the floor says about a real screen, named file and line. */
async function offencesIn(screens: string[]): Promise<string[]> {
  // Without this the check passes vacuously the day the screens are renamed.
  expect(screens.length).toBeGreaterThan(1);

  const results = await eslint.lintFiles(screens);

  return results.flatMap((result) =>
    result.messages
      .filter((message) => message.ruleId === RULE)
      .map(
        (message) =>
          `${path.relative(repoRoot, result.filePath)}:${message.line} ${message.message}`,
      ),
  );
}

describe('what the television already renders', () => {
  it('is above the floor on every screen it draws', async () => {
    expect(
      await offencesIn([...screensIn(TV_APP_SCREENS), path.join(TRIVIA_SOURCES, 'tv-screen.tsx')]),
    ).toEqual([]);
  });
});

describe('what the phone already renders', () => {
  it('is above the floor on every screen it draws', async () => {
    expect(
      await offencesIn([
        // `app` recursively: the scanned Join Link's route is a directory down.
        ...screensIn(CONTROLLER_SCREENS),
        ...screensIn(CONTROLLER_SOURCES),
        path.join(TRIVIA_SOURCES, 'phone-screen.tsx'),
      ]),
    ).toEqual([]);
  });
});

describe('body text under the floor', () => {
  it('is caught in a style sheet, and named with the size it is', async () => {
    const [message] = await complaints(styles('fontSize: 14,'));

    expect(message).toContain('16');
    expect(message).toContain(String(minBodyFontSize.tv));
    expect(message).toContain('minBodyFontSize.tv');
  });

  it('is caught in an inline style as well', async () => {
    expect(
      await complaints(screen('export const Row = () => <View style={{ fontSize: 12 }} />;')),
    ).toHaveLength(1);
    expect(
      await complaints(
        screen(
          'export const Row = () => <Text style={[styles.probe, { fontSize: 12 }]} />;\n' +
            'const styles = StyleSheet.create({ probe: {} });',
        ),
      ),
    ).toHaveLength(1);
  });

  it('is caught after being hoisted to a constant, which is the likelier dodge', async () => {
    expect(
      await complaints(
        screen(
          'const CAPTION = 15;\nexport const styles = StyleSheet.create({ probe: { fontSize: CAPTION } });',
        ),
      ),
    ).toHaveLength(1);
  });

  // The dodge with a token on it: the arithmetic reads as though the floor were
  // being respected, and the number it produces is under the floor.
  it('is caught through arithmetic, token-flavoured or not', async () => {
    expect(await complaints(styles('fontSize: minBodyFontSize.tv - 2,'))).toHaveLength(1);
    expect(await complaints(styles('fontSize: 7 * 2,'))).toHaveLength(1);
  });

  // A name consulted twice in one expression is not a cycle. The guard against
  // following a name round forever is per *path* through the tree, so the
  // second `HALF` still resolves — `HALF * 2` was always caught and this is the
  // same 16.
  it('is caught when one name is consulted twice in the same expression', async () => {
    expect(
      await complaints(
        screen(
          'const HALF = 7;\nexport const styles = StyleSheet.create({ probe: { fontSize: HALF + HALF } });',
        ),
      ),
    ).toHaveLength(1);
  });

  // The likeliest way a real screen ends up under the TV floor: a phone screen
  // ported to the television, keeping the floor it was written against.
  it("is caught when it is the phone's floor standing on a television", async () => {
    expect(await complaints(styles('fontSize: minBodyFontSize.phone,'))).toHaveLength(1);
  });

  it('is caught inside a conditional, whichever arm hides it', async () => {
    expect(await complaints(styles('fontSize: long ? minBodyFontSize.tv : 14,'))).toHaveLength(1);
    expect(await complaints(styles('fontSize: long ? 14 : minBodyFontSize.tv,'))).toHaveLength(1);
  });

  it('is caught on the trivia module\'s television screen, not only in the TV app', async () => {
    expect(await complaints(styles('fontSize: 14,'), A_TRIVIA_TV_SCREEN)).toHaveLength(1);
  });

  // The size the Phone drew its field labels at until this floor was
  // switched on there, and the whole reason the phone block exists.
  it('is caught on the phone under the handoff\'s smallest caption', async () => {
    for (const filePath of [A_CONTROLLER_SCREEN, A_TRIVIA_CONTROLLER_SCREEN]) {
      const [message] = await complaints(styles('fontSize: 11,'), filePath);

      expect(message).toContain('11');
      expect(message).toContain(String(minBodyFontSize.phone));
      expect(message).toContain('minBodyFontSize.phone');
    }
  });
});

describe('body text on the floor or above it', () => {
  it('passes at exactly the floor, however it is written', async () => {
    expect(await complaints(styles('fontSize: minBodyFontSize.tv,'))).toEqual([]);
    expect(await complaints(styles(`fontSize: ${minBodyFontSize.tv},`))).toEqual([]);
    expect(
      await complaints(styles('fontSize: minBodyFontSize.phone,'), A_CONTROLLER_SCREEN),
    ).toEqual([]);
    expect(
      await complaints(styles(`fontSize: ${minBodyFontSize.phone},`), A_CONTROLLER_SCREEN),
    ).toEqual([]);
  });

  it('passes above it', async () => {
    expect(await complaints(styles('fontSize: 22,'))).toEqual([]);
    expect(await complaints(styles('fontSize: 88,'))).toEqual([]);
  });

  it('passes when the screen computed the size and the rule cannot see it', async () => {
    expect(
      await complaints(
        screen(
          'export const Line = ({ size }: any) => <Text style={{ fontSize: size }}>hi</Text>;',
        ),
      ),
    ).toEqual([]);
  });
});

describe('what the floor does not reach', () => {
  // Soft Minimal exempted anything set in its display face, because its floors sat
  // above sizes the handoff genuinely asked for. Soft Minimal's floors *are* the
  // smallest sizes on its scale, so there is nothing to exempt and no face left
  // to claim an exemption with — a family on a style object is now just a family.
  it('no longer spares a style for the face it is set in', async () => {
    expect(await complaints(styles('fontFamily: fontFamily.bold,\nfontSize: 11,'))).toHaveLength(
      1,
    );
    expect(
      await complaints(styles('fontFamily: fontFamily.regular,\nfontSize: 11,')),
    ).toHaveLength(1);
  });

  it('says nothing about the other measurements a text style carries', async () => {
    expect(
      await complaints(
        styles(['width: 12,', 'height: 12,', 'gap: 8,', 'lineHeight: 16,', 'padding: 4,'].join('\n')),
      ),
    ).toEqual([]);
  });

  // A file on neither surface is a file the repo has not said where it is read
  // from, and the floor is a fact about a reading distance rather than about
  // text. Both blocks have to miss it or one of them is over-wide.
  it('says nothing in a package both surfaces import', async () => {
    expect(await complaints(styles('fontSize: 8,'), A_SHARED_SOURCE)).toEqual([]);
  });
});

// Two floors, not a strict one and a lax one: the same sample is judged by the
// distance the screen it is on is read from. 15 is legible in the hand and not
// across a room, and each block has to be the number for its own surface —
// the phone wearing the television's would ban half the Phone, and the
// television wearing the phone's would quietly un-ban what the TV task caught.
describe('the two surfaces judge the same size differently', () => {
  it('lets the phone keep a size the television refuses', async () => {
    expect(await complaints(styles('fontSize: 15,'))).toHaveLength(1);
    expect(await complaints(styles('fontSize: 15,'), A_TRIVIA_TV_SCREEN)).toHaveLength(1);
    expect(await complaints(styles('fontSize: 15,'), A_CONTROLLER_SCREEN)).toEqual([]);
    expect(await complaints(styles('fontSize: 15,'), A_TRIVIA_CONTROLLER_SCREEN)).toEqual([]);
  });

  it('refuses on both what is under both', async () => {
    expect(await complaints(styles('fontSize: 11,'))).toHaveLength(1);
    expect(await complaints(styles('fontSize: 11,'), A_CONTROLLER_SCREEN)).toHaveLength(1);
  });

  // The exemption stops being forward-looking here: on the television the
  // smallest display size is 20 and nothing sits in it, but the phone draws its
  // HOST pill in Bungee at 13, under its own floor and outside it.
  it('judges the phone by the phone floor, whatever face carries the size', async () => {
    expect(
      await complaints(styles('fontFamily: fontFamily.bold,\nfontSize: 11,'), A_CONTROLLER_SCREEN),
    ).toHaveLength(1);
    expect(
      await complaints(styles('fontFamily: fontFamily.bold,\nfontSize: 13,'), A_CONTROLLER_SCREEN),
    ).toEqual([]);
  });
});
