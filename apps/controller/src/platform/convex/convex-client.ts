import { ConvexReactClient } from 'convex/react';

/**
 * The Controller's connection to Convex, created once per launch and handed to
 * `ConvexProvider` in the root layout.
 *
 * The deployment URL is configuration, never a literal: Metro inlines
 * `EXPO_PUBLIC_CONVEX_URL` at bundle time from `apps/controller/.env` (the
 * committed default: the huddle cloud dev deployment, the same one the TV app
 * points at) or `apps/controller/.env.local` (yours, gitignored).
 */
const deploymentUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (deploymentUrl === undefined || deploymentUrl === '') {
  // Failing loudly at launch beats a join screen that swallows every tap:
  // without a backend there is no room to join, and the fix is a config file.
  throw new Error(
    'EXPO_PUBLIC_CONVEX_URL is not set — the Controller has no Convex deployment to join a room on. See apps/controller/.env.',
  );
}

export const convexClient = new ConvexReactClient(deploymentUrl);
