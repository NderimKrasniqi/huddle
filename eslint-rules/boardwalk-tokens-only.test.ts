import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { colors } from '@huddle/ui';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * `boardwalk/tokens-only` exercised through ESLint itself, against the repo's
 * real `eslint.config.js`, rather than through `RuleTester`.
 *
 * The acceptance criterion is that `pnpm lint` fails — so what is worth pinning
 * is the whole gate: the rule, the files it is switched on for, and the
 * `packages/ui` exemption. A `RuleTester` would pin the rule alone and stay
 * green through a config that never turned it on.
 *
 * Every sample is linted at a real path inside the trivia module, because the
 * config keys on the path. `lintText` never touches the disk, so the file names
 * below are not files.
 */

const RULE = 'boardwalk/tokens-only';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trim();

const TRIVIA_SOURCES = path.join(repoRoot, 'packages/games/trivia/src');
const A_TRIVIA_SCREEN = path.join(TRIVIA_SOURCES, 'tokens-only-probe.tsx');
const A_THEME_SOURCE = path.join(repoRoot, 'packages/ui/src/tokens-only-probe.tsx');

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

/** What the rule says about `code`, and nothing about what any other rule says. */
async function complaints(code: string, filePath = A_TRIVIA_SCREEN): Promise<string[]> {
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
    "import { borderWidth, colors, fontFamily, radius, shadowDepth } from '@huddle/ui';",
    "import { StickerSurface } from '@huddle/ui/native';",
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

describe('the trivia screens', () => {
  it('are already on tokens alone', async () => {
    const screens = readdirSync(TRIVIA_SOURCES)
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => path.join(TRIVIA_SOURCES, file));

    // Without this the check passes vacuously the day the screens are renamed.
    expect(screens.length).toBeGreaterThan(0);

    const results = await eslint.lintFiles(screens);
    const offences = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId === RULE)
        .map((message) => `${path.relative(repoRoot, result.filePath)}:${message.line} ${message.message}`),
    );

    expect(offences).toEqual([]);
  });
});

describe('a design value written at a call site', () => {
  // The hexes come from the tokens rather than being typed out, because
  // `packages/ui/src/color-literals.test.ts` bans a hex anywhere else in the
  // repo and this file is not worth an exemption from it. It reads truer this
  // way in any case: the rule fires on Boardwalk's *own* ink, so what it is
  // objecting to is plainly where the value was written and not which colour it
  // is. `rebeccapurple` is the case only this rule can see — no hex, so the
  // sibling guard is blind to it.
  it('is caught as a colour', async () => {
    expect(await complaints(styles(`color: '${colors.ink}',`))).toHaveLength(1);
    expect(await complaints(styles("backgroundColor: 'rebeccapurple',"))).toHaveLength(1);
    expect(await complaints(styles(`borderColor: '${colors.ink}',`))).toHaveLength(1);
  });

  it('is caught as a radius', async () => {
    expect(await complaints(styles('borderRadius: 24,'))).toHaveLength(1);
    expect(await complaints(styles('borderTopLeftRadius: 999,'))).toHaveLength(1);
  });

  it('is caught as a border width', async () => {
    expect(await complaints(styles('borderWidth: 3,'))).toHaveLength(1);
    expect(await complaints(styles('borderBottomWidth: 4,'))).toHaveLength(1);
  });

  it('is caught as a font family', async () => {
    expect(await complaints(styles("fontFamily: 'Bungee_400Regular',"))).toHaveLength(1);
  });

  it('is caught as a shadow depth on the surface that takes one', async () => {
    expect(
      await complaints(screen('export const Card = () => <StickerSurface depth={6} />;')),
    ).toHaveLength(1);
    expect(
      await complaints(
        screen(
          `export const Card = () => <StickerSurface depth={shadowDepth.tvCard} shadowColor='${colors.punch}' />;`,
        ),
      ),
    ).toHaveLength(1);
  });

  it('is caught in an inline style as well as in a style sheet', async () => {
    expect(
      await complaints(screen('export const Row = () => <View style={{ borderWidth: 3 }} />;')),
    ).toHaveLength(1);
    expect(
      await complaints(
        screen(
          'export const Row = () => <View style={[styles.probe, { borderRadius: 24 }]} />;\n' +
            'const styles = StyleSheet.create({ probe: {} });',
        ),
      ),
    ).toHaveLength(1);
  });

  it('is caught inside a conditional, whichever arm hides it', async () => {
    expect(
      await complaints(styles('borderWidth: wide ? borderWidth.thick : 3,')),
    ).toHaveLength(1);
    expect(
      await complaints(styles('borderWidth: wide ? 3 : borderWidth.thin,')),
    ).toHaveLength(1);
  });

  // Arithmetic is the cheapest dodge there is — four characters, no
  // restructuring — so it is judged by what it is made of rather than by being
  // an expression. `radius.pill + 4` is the interesting half: a design decision
  // wearing a token as a disguise.
  it('is caught through arithmetic, token-flavoured or not', async () => {
    expect(await complaints(styles('borderRadius: 24 + 0,'))).toHaveLength(1);
    expect(await complaints(styles('borderWidth: 3 * 1,'))).toHaveLength(1);
    expect(await complaints(styles('borderRadius: radius.pill + 4,'))).toHaveLength(1);
    expect(await complaints(styles("color: '#FF' + '5F5F',"))).toHaveLength(1);
  });

  it('is caught after being hoisted to a constant, which is the likelier dodge', async () => {
    expect(
      await complaints(
        screen(
          'const CARD_RADIUS = 24;\nexport const styles = StyleSheet.create({ probe: { borderRadius: CARD_RADIUS } });',
        ),
      ),
    ).toHaveLength(1);
  });

  it('names where a value came from when it came from another module', async () => {
    const [message] = await complaints(
      screen(
        "import { somewhereElse } from './elsewhere';\n" +
          'export const styles = StyleSheet.create({ probe: { borderColor: somewhereElse.ink } });',
      ),
    );

    // The message a developer is likeliest to hit, so it has to be true of what
    // they wrote: `somewhereElse` is not declared in this file.
    expect(message).toContain("`somewhereElse` comes from `./elsewhere`");
    expect(message).not.toContain('declared in this file');
  });

  it('is caught as a font weight, because a weight is how a face gets chosen by hand', async () => {
    const [message] = await complaints(styles("fontFamily: fontFamily.body,\nfontWeight: '700',"));

    expect(message).toContain('fontFamily.bodyBold');
  });
});

describe('a design value taken from the theme', () => {
  it('passes in every form the screens use', async () => {
    expect(
      await complaints(
        styles(
          [
            'backgroundColor: colors.surface,',
            'borderColor: colors.ink,',
            'borderRadius: radius.pill,',
            'borderWidth: borderWidth.thick,',
            'fontFamily: fontFamily.display,',
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  it('passes when it arrives through a value the screen computed', async () => {
    expect(
      await complaints(
        screen(
          [
            "import { accentFace, playerFace } from '@huddle/ui';",
            'export const Option = ({ index, color, winner }: any) => {',
            '  const face = accentFace(index);',
            '  return (',
            '    <StickerSurface',
            '      depth={winner ? shadowDepth.tvCardHighlight : shadowDepth.tvCard}',
            '      shadowColor={winner ? colors.punch : colors.ink}',
            '      style={{ backgroundColor: face.fill, borderColor: playerFace(color).monogram }}',
            '    />',
            '  );',
            '};',
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  // The finding that matters most for whether the gate survives: hoisting a
  // tokenised value out of a component for reuse is an ordinary thing to do,
  // and a rule that objected to it is one somebody switches off.
  it('passes when a module-level name holds something the theme built', async () => {
    expect(
      await complaints(
        screen(
          [
            "import { accentFace } from '@huddle/ui';",
            'const HOST_FACE = accentFace(0);',
            'const ink = colors.ink;',
            'const BRAND = { border: colors.ink };',
            'export const styles = StyleSheet.create({',
            '  probe: { backgroundColor: HOST_FACE.fill, color: ink, borderColor: BRAND.border },',
            '});',
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  // A name used twice in one hoisted value is not a cycle, and the guard that
  // stops the tracing following a name round forever must not mistake it for
  // one: reading `ink` a second time would otherwise report Boardwalk's own
  // token as a value of this file's own.
  it('passes when one tokenised name is read twice in the same hoisted value', async () => {
    expect(
      await complaints(
        screen(
          [
            'const ink = colors.ink;',
            'const BRAND = { border: ink, text: ink };',
            'export const styles = StyleSheet.create({',
            '  probe: { borderColor: BRAND.border, color: BRAND.text },',
            '});',
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  it('passes when a surface has no shadow at all, which zero is and no token names', async () => {
    expect(
      await complaints(
        screen(
          'export const Seat = ({ news }: any) => <StickerSurface depth={news?.depth ?? 0} shadowColor={news?.color} />;',
        ),
      ),
    ).toEqual([]);
    expect(await complaints(styles('borderWidth: 0,'))).toEqual([]);
  });

  // `transparent` is the colour-shaped version of that zero: the absence of a
  // design value rather than one of Boardwalk's, and the palette holds no token
  // for it because there is nothing there to name.
  it('passes when a colour is the absence of one', async () => {
    expect(await complaints(styles("borderColor: 'transparent',"))).toEqual([]);
    expect(await complaints(styles("backgroundColor: 'transparent',"))).toEqual([]);
  });
});

describe('what the rule leaves alone', () => {
  it('says nothing about sizes and spacing, which the handoff writes as measurements', async () => {
    expect(
      await complaints(
        styles(
          [
            'width: 148,',
            'height: 176,',
            'minWidth: 88,',
            'maxWidth: 402,',
            'gap: 18,',
            'paddingHorizontal: 26,',
            'fontSize: 88,',
            'lineHeight: 96,',
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  it('says nothing about a Player Color name, which is protocol and not a colour', async () => {
    expect(
      await complaints(
        screen(
          [
            "export const metadata = { keyArt: { color: 'punch' } };",
            "export const Row = () => <View color='punch' />;",
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  // `depth` is an ordinary word for a tree node's nesting. The shadow props are
  // read on Boardwalk's one shadow-bearing surface and nowhere else, which is
  // what the docs say and now what the rule does.
  it('says nothing about a depth that is not a shadow', async () => {
    expect(
      await complaints(screen('export const Node = () => <TreeNode depth={2} />;')),
    ).toEqual([]);
    expect(
      await complaints(screen('export const Card = () => <StickerSurface depth={2} />;')),
    ).toHaveLength(1);
  });

  it('says nothing inside packages/ui, which is where a design value belongs', async () => {
    expect(
      await complaints(styles(`borderWidth: 3,\ncolor: '${colors.ink}',`), A_THEME_SOURCE),
    ).toEqual([]);
  });
});
