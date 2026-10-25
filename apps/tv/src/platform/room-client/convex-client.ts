import { ConvexReactClient } from 'convex/react';

/**
 * The TV app's connection to Convex, created once per launch and handed to
 * `ConvexProvider` in the root layout — or `undefined` when this build has no
 * deployment to connect to.
 *
 * The deployment URL is configuration, never a literal: Metro inlines
 * `EXPO_PUBLIC_CONVEX_URL` at bundle time from `apps/tv/.env` (the committed
 * default: the huddle cloud dev deployment) or `apps/tv/.env.local` (yours,
 * gitignored). Pointing the TV somewhere else is therefore an edit to one line
 * of config, not to this file.
 *
 * **Nothing here throws.** It used to, on the argument that failing loudly at
 * launch beats a pairing screen that spins forever — but the TV app is
 * untouched after launch and has no remote surface, so a module that throws at
 * import is a black television that nobody in the room can do anything about,
 * and the loud failure is heard by nobody. `undefined` instead, which the
 * pairing screen turns into a line saying which setting is missing (see
 * `roomOpeningCaption`), and the log below for whoever installed the app.
 */
/**
 * Local, like the Phone's. It used to be exported: "which deployment is
 * that television on?" is a question a party asks out loud, and the About Panel
 * was where it answered. The panel is gone, so the only reader left is the
 * connection below and the log it writes when there is nothing to connect to.
 */
const deploymentUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

export const convexClient = openConnection(deploymentUrl);

/**
 * A missing URL and a typo'd one are one case: they fail at the same moment,
 * they leave the TV with the same nothing, and they want the same edit to the
 * same file. The constructor is what rejects the second — it refuses anything
 * that is not an absolute URL — so both end up here.
 */
function openConnection(url: string | undefined): ConvexReactClient | undefined {
  try {
    if (url !== undefined && url !== '') {
      return new ConvexReactClient(url);
    }
  } catch (error) {
    console.warn(
      `Huddle TV cannot open a Convex connection on EXPO_PUBLIC_CONVEX_URL (${url}):`,
      error,
    );
    return undefined;
  }

  console.warn(
    'Huddle TV has no Convex deployment to open a room on: EXPO_PUBLIC_CONVEX_URL is not set. See apps/tv/.env.',
  );
  return undefined;
}
