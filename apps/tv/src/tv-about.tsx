import { GAME_REGISTRY } from '@huddle/game-registry';
import {
  borderWidth,
  colors,
  fontFamily,
  letterSpacing,
  minBodyFontSize,
  radius,
  elevation,
} from '@huddle/ui';
import { Surface } from '@huddle/ui/native';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import * as ReactNative from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  ABOUT_PANEL_MS,
  type AboutLine,
  aboutLines,
  aboutPanelAfter,
  type BuildStamp,
  type RemotePress,
} from './about';
import { deploymentUrl } from './convex-client';

/**
 * The About Panel — the one control on this television a remote can reach, and
 * the only file in the app allowed to hold the remote at all
 * (`huddle/tv-remote-surface` names it, `eslint.config.js` points the rule at
 * it). `./about` carries the reasoning for both halves of that; this file is
 * what it looks like.
 *
 * It is drawn by `TvStage` rather than by any screen, which is what puts it on
 * all four — pairing, carousel, a game, and the unknown-game screen — by
 * construction instead of by four call sites remembering to.
 *
 * The handoff draws no About screen, so this extends Boardwalk the way the
 * trivia screens did: a card the system already knows how to draw — surface
 * fill, 4px ink border, a large card's radius, a TV card's offset shadow and a
 * sticker tilt — with the HOST pill's ink badge as its heading. No scrim behind
 * it. A dimmed screen would need a colour Boardwalk does not hold, and the hard
 * offset shadow is how this system separates a surface from what is under it.
 */

/**
 * `useTVEventHandler`, reached past a hole in `react-native-tvos`'s type
 * packaging rather than imported by name — because by name it does not
 * typecheck, and the reason is worth writing down once.
 *
 * The library adds every TV-only API to React Native's types as a module
 * augmentation (`types/public/ReactNativeTVTypes.d.ts`, opening
 * `declare module 'react-native'`). Two things go wrong with that here, and
 * `tsc --traceResolution` shows both:
 *
 * 1. **The augmentation lands on the wrong module.** Resolved from inside
 *    `.pnpm/react-native-tvos@…/node_modules/react-native-tvos/`, the bare
 *    name `react-native` finds the *stock* React Native in the pnpm store —
 *    the copy `packages/ui` keeps as a dev dependency — not the tvOS package
 *    this app's `react-native` alias points at. So the TV additions are
 *    declared onto a module the TV app never reads.
 * 2. **Declaring them again from here would not work either.** A `.d.ts` in
 *    this app resolves `react-native` to the right package, but a module
 *    augmentation may only patch existing declarations — it cannot introduce a
 *    new top-level export. Probed rather than assumed: an added `ViewProps`
 *    member merged and an added `const` stayed invisible.
 *
 * So the export is read off the namespace and checked at runtime, which is the
 * honest shape of the situation — the value is really there, and only its
 * declaration is missing. The check is not ceremony: a television that threw on
 * `undefined(...)` at launch would be a black screen nobody in the room could
 * fix, which is the same reasoning `convex-client.ts` stopped throwing for.
 */
type RemoteListener = (handleEvent: (press: RemotePress) => void) => void;

const remoteListener = (ReactNative as { readonly useTVEventHandler?: RemoteListener })
  .useTVEventHandler;

const useRemotePresses: RemoteListener =
  typeof remoteListener === 'function' ? remoteListener : useNoRemote;

/** A build with no remote to listen to. Fixed at module scope, so the hook order never moves. */
function useNoRemote(): void {}

/**
 * What this build is, read once at module scope: none of it can change while
 * the television is on. The Convex deployment and the version are both inlined
 * at bundle time, and the Registry is a literal.
 */
const buildStamp: BuildStamp = {
  version: Constants.expoConfig?.version,
  debug: __DEV__,
  deploymentUrl,
  gameIds: GAME_REGISTRY.map((game) => game.metadata.id),
};

export function AboutPanel() {
  const shown = useAboutPanel();

  if (!shown) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Surface
        elevation={elevation.tvCard}
        style={styles.panel}
      >
        <View style={styles.heading}>
          <Text style={styles.headingText}>ABOUT</Text>
        </View>

        {aboutLines(buildStamp).map((line) => (
          <AboutRow key={line.label} line={line} />
        ))}

        {/* The way out, said on the panel itself: every key closes it, and it
            goes on its own in twenty seconds either way. */}
        <Text style={styles.dismiss}>any button closes this</Text>
      </Surface>
    </View>
  );
}

/** One fact about the build: Boardwalk's field label, and the answer under it. */
function AboutRow({ line }: { readonly line: AboutLine }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{line.label}</Text>
      <Text style={styles.value}>{line.value}</Text>
    </View>
  );
}

/**
 * Whether the panel is up — the app's entire remote surface.
 *
 * `useTVEventHandler` listens at the root, which is why this works on a
 * television where nothing is focusable: on tvOS the root view's own gesture
 * recognisers report the remote's keys with nothing focused, and on Android TV
 * the activity sees them. Most of the remote arrives here — the directions and
 * OK included, which is not what an earlier draft of `./about` claimed — and
 * `aboutPanelAfter` is what decides that this app answers one of them.
 *
 * The timeout is the half that keeps "zero remote interaction after launch"
 * true: a guest can put this panel up and then put the remote down, and the
 * television takes it away again without anybody touching anything.
 */
function useAboutPanel(): boolean {
  const [shown, setShown] = useState(false);

  // Stable, because `useTVEventHandler` re-subscribes whenever the callback
  // changes and a fresh closure every render would resubscribe every render.
  const onRemotePress = useCallback((press: RemotePress) => {
    setShown((up) => aboutPanelAfter(up, press));
  }, []);

  useRemotePresses(onRemotePress);

  useEffect(() => {
    if (!shown) {
      return undefined;
    }

    const timer = setTimeout(() => setShown(false), ABOUT_PANEL_MS);

    return () => clearTimeout(timer);
  }, [shown]);

  return shown;
}

// The handoff's own numbers where it has them, at its 1280×720 design size;
// `TvStage` scales the lot to the television.
const styles = StyleSheet.create({
  // Over the whole Stage, centred on it. Absolute rather than laid out: the
  // panel must not move a single thing on the screen it appears over.
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 560,
    alignItems: 'flex-start',
    gap: 22,
    paddingHorizontal: 40,
    paddingVertical: 36,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.cardLarge,
  },

  // The HOST pill's treatment: ink fill, white Bungee. A quiet badge for a
  // quiet screen — the tangerine one belongs to the invitation on the pairing
  // screen, which is the loudest thing this television says.
  heading: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
  },
  headingText: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    letterSpacing: letterSpacing.badge,
  },

  row: {
    gap: 4,
  },
  label: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
    letterSpacing: letterSpacing.label,
  },
  value: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 26,
  },
  dismiss: {
    color: colors.mutedText,
    fontFamily: fontFamily.regular,
    fontSize: minBodyFontSize.tv,
  },
});
