import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * `huddle/tv-remote-surface` exercised through ESLint itself, against the
 * repo's real `eslint.config.js`, rather than through `RuleTester` — the same
 * choice Boardwalk's two rules made, for the same reason. The acceptance
 * criterion is about the *app*, so what has to be pinned is the whole gate: the
 * rule and the paths it is switched on for.
 *
 * There is no longer an exempt file. `tv-about.tsx` used to be allowed to hold
 * a remote listener; the About Panel is not in the approved design, so the file
 * and the exemption went with it, and every case below now expects the strict
 * answer everywhere.
 *
 * The first block below is the acceptance criterion itself rather than a test
 * of the rule: every TV screen this app can show, linted, with nothing
 * focusable in any of them.
 */

const RULE = 'huddle/tv-remote-surface';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trim();

/** Any TV screen. `lintText` never touches the disk, so this is not a file. */
const A_TV_SCREEN = path.join(repoRoot, 'apps/tv/app/remote-surface-probe.tsx');
/** A game module's TV screen, which stands on the same surface. */
const A_MODULE_TV_SCREEN = path.join(
  repoRoot,
  'packages/games/trivia/src/tv-remote-surface-probe.tsx',
);
/** The phone, where a control is the entire point. */
const A_PHONE_SCREEN = path.join(repoRoot, 'apps/controller/app/remote-surface-probe.tsx');

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

/**
 * A screen that imports React Native, so the samples below can draw something.
 * The remote's own two names are pointedly not imported here — importing one is
 * itself a thing the rule judges, so it belongs in the samples that mean it.
 */
function screen(body: string): string {
  return [
    "import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';",
    "import { Animated, Button, TouchableHighlight, TouchableOpacity } from 'react-native';",
    '',
    body,
    '',
  ].join('\n');
}

/** Every source file the TV surface is made of, app and game modules alike. */
function tvSources(): string[] {
  const appSources = ['apps/tv/app', 'apps/tv/src'].flatMap((directory) =>
    readdirSync(path.join(repoRoot, directory))
      .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
      .map((file) => path.join(repoRoot, directory, file)),
  );

  const games = path.join(repoRoot, 'packages/games');
  const moduleScreens = readdirSync(games).flatMap((game) =>
    readdirSync(path.join(games, game, 'src'))
      .filter((file) => file.startsWith('tv-') && file.endsWith('.tsx'))
      .map((file) => path.join(games, game, 'src', file)),
  );

  return [...appSources, ...moduleScreens];
}

describe('the TV app', () => {
  it('has nothing a remote can focus, on any screen it can show', async () => {
    const sources = tvSources();

    // Without these the criterion passes vacuously the day a directory moves.
    expect(sources.length).toBeGreaterThan(0);
    expect(sources).toContain(path.join(repoRoot, 'apps/tv/app/index.tsx'));
    expect(sources.some((file) => file.includes('/packages/games/'))).toBe(true);

    const results = await eslint.lintFiles(sources);
    const offences = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId === RULE)
        .map(
          (message) =>
            `${path.relative(repoRoot, result.filePath)}:${message.line} ${message.message}`,
        ),
    );

    // This lints every TV source there is, which takes seconds rather than
    // milliseconds — see the `lint-rules` project in vitest.config.ts, which
    // is where that fact is written down for all three of these files. Linting
    // fewer of the screens is the one thing this check may not do.
    expect(offences).toEqual([]);
  });
});

describe('a focusable control put on a TV screen', () => {
  it('is caught by the component it is drawn with', async () => {
    expect(
      await complaints(screen('export const A = () => <Pressable><Text>x</Text></Pressable>;')),
    ).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <TouchableOpacity />;')),
    ).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <TouchableHighlight />;')),
    ).toHaveLength(1);
    expect(await complaints(screen('export const A = () => <Button title="x" />;'))).toHaveLength(
      1,
    );
    expect(await complaints(screen('export const A = () => <TextInput />;'))).toHaveLength(1);
    expect(await complaints(screen('export const A = () => <Switch />;'))).toHaveLength(1);
  });

  // The stage is a fixed 1280×720 surface that never scrolls, so a scroll view
  // is either a mistake or a decision to give the remote something to drive.
  it('is caught when it is a scrolling surface rather than a button', async () => {
    expect(await complaints(screen('export const A = () => <ScrollView />;'))).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <Animated.FlatList data={[]} />;')),
    ).toHaveLength(1);
  });

  // The one that matters most on Android TV: a plain `View` is not focusable
  // until somebody says it is, and then it is.
  it('is caught by the prop that makes an ordinary view focusable', async () => {
    expect(await complaints(screen('export const A = () => <View focusable />;'))).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <View tvFocusable={true} />;')),
    ).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <View hasTVPreferredFocus />;')),
    ).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <View nextFocusDown={2} />;')),
    ).toHaveLength(1);
  });

  it('is caught by the handler hung on it, whatever it is drawn with', async () => {
    expect(
      await complaints(screen('export const A = () => <View onPress={() => {}} />;')),
    ).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <View onFocus={() => {}} />;')),
    ).toHaveLength(1);
    expect(
      await complaints(screen('export const A = () => <Animated.View onLongPress={() => {}} />;')),
    ).toHaveLength(1);
  });

  it('is caught on a game module’s TV screen too, which is the same surface', async () => {
    expect(
      await complaints(
        screen('export const A = () => <Pressable />;'),
        A_MODULE_TV_SCREEN,
      ),
    ).toHaveLength(1);
  });

  it('sends the author to the Controller, which is where a control belongs', async () => {
    const [message] = await complaints(screen('export const A = () => <Pressable />;'));

    expect(message).toContain('Controller');
  });
});

describe('the remote listener', () => {
  it('is caught on a TV screen', async () => {
    expect(
      await complaints(
        [
          "import { useTVEventHandler } from 'react-native';",
          'export const useIt = () => useTVEventHandler(() => {});',
        ].join('\n'),
      ),
      // The import and the call: the rule reports the remote wherever it is
      // written, so one listener wired up in two lines is two complaints.
    ).toHaveLength(2);
    expect(
      await complaints(
        [
          "import { TVEventHandler } from 'react-native';",
          'export const listen = () => TVEventHandler.addListener(() => {});',
        ].join('\n'),
      ),
      // Two: the import, and the use. Both are the remote, and a rule that
      // counted only one of them is the rule the next paragraph is about.
    ).toHaveLength(2);
  });

  // The form the About Panel itself had to take, because `react-native-tvos`
  // types the hook onto a module pnpm puts out of the app's reach. A gate that
  // watched imports alone would wave this through — which is to say it would
  // wave through the one route that is actually open. The panel is gone; the
  // route it had to use is still there for the next author to find.
  it('is caught when it is reached off the namespace rather than imported', async () => {
    expect(
      await complaints(
        [
          "import * as ReactNative from 'react-native';",
          'export const listen = ReactNative.useTVEventHandler;',
        ].join('\n'),
      ),
    ).toHaveLength(1);
    expect(
      await complaints(
        [
          "import * as ReactNative from 'react-native';",
          'export const { useTVEventHandler } = ReactNative;',
        ].join('\n'),
      ),
      // The key and the bound name, which is one dodge written twice.
    ).toHaveLength(2);
  });

  // The exemption is gone rather than dormant. This is the file that held it,
  // and the point of the case is that its name buys it nothing now — a listener
  // put back at this path is caught like a listener anywhere else.
  it('is caught in the file that used to be allowed to hold it', async () => {
    expect(
      await complaints(
        [
          "import { useTVEventHandler } from 'react-native';",
          'export const useIt = () => useTVEventHandler(() => {});',
        ].join('\n'),
        path.join(repoRoot, 'apps/tv/src/tv-about.tsx'),
      ),
    ).toHaveLength(2);
  });
});

describe('what the rule leaves alone', () => {
  it('says nothing about the surfaces a TV screen is actually made of', async () => {
    expect(
      await complaints(
        screen(
          [
            'export const A = () => (',
            '  <View style={styles.a}>',
            '    <Text>HUDDLE.</Text>',
            '    <Animated.Text>x</Animated.Text>',
            '  </View>',
            ');',
            'const styles = StyleSheet.create({ a: {} });',
          ].join('\n'),
        ),
      ),
    ).toEqual([]);
  });

  // Saying "not this one" is the opposite of adding a control, and on Android
  // TV it is occasionally the fix.
  it('says nothing about a view declaring itself unfocusable', async () => {
    expect(await complaints(screen('export const A = () => <View focusable={false} />;'))).toEqual(
      [],
    );
  });

  it('says nothing on the phone, where a control is the entire point', async () => {
    expect(
      await complaints(
        screen('export const A = () => <Pressable onPress={() => {}}><TextInput /></Pressable>;'),
        A_PHONE_SCREEN,
      ),
    ).toEqual([]);
  });
});
