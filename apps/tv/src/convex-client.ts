import { ConvexReactClient } from 'convex/react';

/**
 * The TV app's connection to Convex, created once per launch and handed to
 * `ConvexProvider` in the root layout.
 *
 * The deployment URL is configuration, never a literal: Metro inlines
 * `EXPO_PUBLIC_CONVEX_URL` at bundle time from `apps/tv/.env` (the committed
 * default: the local backend) or `apps/tv/.env.local` (yours, gitignored).
 * Pointing the TV at the Convex cloud deployment in Phase 5 is therefore an
 * edit to one line of config, not to this file.
 */
const deploymentUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (deploymentUrl === undefined || deploymentUrl === '') {
  // Failing loudly at launch beats a pairing screen that spins forever: without
  // a backend there is no room to show, and the fix is a config file.
  throw new Error(
    'EXPO_PUBLIC_CONVEX_URL is not set — the TV app has no Convex deployment to open a room on. See apps/tv/.env.',
  );
}

export const convexClient = new ConvexReactClient(deploymentUrl);
