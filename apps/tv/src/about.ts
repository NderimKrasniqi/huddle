/**
 * The About Panel: what a remote can reach on this television, and the only
 * thing it can.
 *
 * ## The two halves of "zero remote interaction", and why they do not collide
 *
 * The plan asks for a TV app that requires no remote interaction after launch
 * *and* for one remote-reachable control, which reads like a contradiction
 * until the word focus is put in. Nothing on any TV screen is focusable —
 * `huddle/tv-remote-surface` is the gate that keeps it that way — so the
 * remote's directions and its OK button have nothing to *land on*: pressing
 * them moves no highlight, opens nothing, and changes nothing about the room.
 * There is no state this television waits in for a press, which is what
 * "requires zero remote interaction" means.
 *
 * Note what that does and does not say. The keys still *arrive*: both platforms
 * deliver the four directions and OK to the root view whether or not anything
 * is focused, so this module hears them. What is absent is anywhere for them to
 * go. The panel is reached the same way — the app listens at the root — and the
 * difference between it and every other key is only that this module answers
 * one of them. So "requires none" and "one control" are two claims about two
 * mechanisms, focus and a root listener, and both are true.
 *
 * ## And it always leaves by itself
 *
 * Every press closes the panel, including the one that opened it, and it closes
 * on its own after `ABOUT_PANEL_MS` regardless. That is not politeness — it is
 * what keeps the first half of the claim true in the presence of the second. A
 * panel that needed a second press to dismiss would be a state a guest could
 * put the television into and a state the room would then have to press its way
 * out of, on the one screen everybody is looking at.
 *
 * "Every press" is meant literally, and OK is the case worth naming: `select`
 * does reach this module, so pressing OK at an open panel closes it. That is
 * the wanted behaviour rather than a side effect — OK is what somebody who
 * wants a panel gone will press first, and the alternative is a panel that
 * ignores the most obvious button on the remote. When the panel is closed the
 * same press does nothing at all, which is the first half of the criterion:
 * `aboutPanelAfter` hands back the state it was given.
 */

/** A press of the remote, as `react-native-tvos` reports it to `useTVEventHandler`. */
export type RemotePress = {
  readonly eventType: string;
  /** 0 while the key is going down, 1 as it comes back up; absent for a gesture. */
  readonly eventKeyAction?: number | undefined;
};

/**
 * Play/pause: the key that summons the panel.
 *
 * Chosen for what a party will press by accident, **not** because it is the
 * only key that reaches an app with nothing focused. An earlier version of this
 * comment claimed the latter about `select` and it was wrong: tvOS installs a
 * second handler, `RCTTVRemoteSelectHandler`, on the root view right beside
 * `RCTTVRemoteHandler` (`RCTRootView.m:104-105`, and
 * `RCTSurfaceHostingProxyRootView.mm:183-184` for the Fabric path this app
 * takes), and its `UIPressTypeSelect` recogniser posts `select` from the root
 * regardless of focus. Android maps `KEYCODE_DPAD_CENTER`, `ENTER` and `SPACE`
 * to `select` with no focus condition at all. The four directions likewise
 * arrive on both. The honest position is that most of the remote reaches this
 * module and this module answers one key.
 *
 * That key is play/pause because a television running a party is not playing
 * media, so it is the button nobody reaches for by accident, and because this
 * app binds it to nothing else. It is `UIPressTypePlayPause` on the Siri remote
 * and `KEYCODE_MEDIA_PLAY_PAUSE` on an Android TV remote. `menu` was rejected
 * for a different reason that does still hold: on tvOS it exits to the home
 * screen unless the app takes the key over, and an app that is hard to leave is
 * worse than one with no About Panel.
 */
export const ABOUT_PANEL_KEY = 'playPause';

/** How long the panel stays up on its own: long enough to read three lines aloud. */
export const ABOUT_PANEL_MS = 20_000;

/** The key going down, which is the half of an Android press that is not the press. */
const KEY_DOWN = 0;

/**
 * Whether the panel is up after a press of the remote.
 *
 * Android reports a key twice — down, then up — where tvOS reports a tap once,
 * on the way up. Acting on the release is what makes one press mean one press
 * on both: without it a single Android play/pause would open the panel and
 * close it again in the same instant.
 */
export function aboutPanelAfter(shown: boolean, press: RemotePress): boolean {
  if (press.eventKeyAction === KEY_DOWN) {
    return shown;
  }

  // Anything at all takes it down — see the note above on why that matters more
  // than which key does.
  return shown ? false : press.eventType === ABOUT_PANEL_KEY;
}

/**
 * What identifies the build a party is actually running.
 *
 * Version alone does not: it is a line in `app.json` that changes when somebody
 * remembers, and the questions that come up around a television are which
 * *deployment* its rooms live on, whether it is a debug build that will die with
 * the laptop serving it, and which games it can draw when a phone starts one.
 */
export type BuildStamp = {
  /** From the Expo config; absent when this build was assembled without one. */
  readonly version: string | undefined;
  readonly debug: boolean;
  /** `EXPO_PUBLIC_CONVEX_URL` as this bundle was given it. */
  readonly deploymentUrl: string | undefined;
  /** The installed Game Modules, in Registry order. */
  readonly gameIds: readonly string[];
};

/** One row of the panel: a Boardwalk label and the answer beside it. */
export type AboutLine = {
  readonly label: string;
  readonly value: string;
};

/** The panel's three lines, in the order it draws them. */
export function aboutLines(build: BuildStamp): readonly AboutLine[] {
  const version = build.version ?? 'unknown';

  return [
    { label: 'VERSION', value: build.debug ? `${version} (debug)` : version },
    { label: 'ROOM SERVER', value: deploymentHost(build.deploymentUrl) },
    {
      label: 'GAMES',
      value: build.gameIds.length === 0 ? 'none installed' : build.gameIds.join(', '),
    },
  ];
}

/**
 * The deployment as a host — `cheerful-otter-123.convex.cloud`, or
 * `127.0.0.1:3210` for the local backend this project spent a phase on.
 *
 * Read with a pattern rather than with `URL`, which React Native supplies as an
 * incomplete polyfill: the answer has to be the same on a television as it is
 * in this module's test, and a string this cannot read is handed back as it was
 * written. A URL that is not one is precisely what somebody who opened this
 * panel needs to see.
 */
function deploymentHost(url: string | undefined): string {
  if (url === undefined || url === '') {
    return 'not configured';
  }

  const host = /^[a-z][a-z\d+.-]*:\/\/([^/?#]+)/i.exec(url)?.[1];

  return host ?? url;
}
