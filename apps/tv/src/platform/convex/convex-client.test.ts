import { ConvexReactClient } from 'convex/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A fresh import of `convex-client.ts` with `EXPO_PUBLIC_CONVEX_URL` set to
 * `configured` — the module reads it once, at import, exactly as Metro inlines
 * it into the bundle.
 */
async function launchWith(configured: string | undefined) {
  vi.stubEnv('EXPO_PUBLIC_CONVEX_URL', configured);
  vi.resetModules();
  return import('./convex-client');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('convexClient', () => {
  it('connects to the deployment it is configured with', async () => {
    // A well-formed URL that belongs to no deployment: the suite must not
    // depend on a real backend being up, and the client is never asked for
    // anything, so nothing here reaches the network.
    const address = 'https://test-deployment-0000.convex.cloud';
    const { convexClient } = await launchWith(address);

    expect(convexClient).toBeInstanceOf(ConvexReactClient);
    expect(convexClient?.url).toBe(address);

    await convexClient?.close();
  });

  it('survives a launch with no deployment configured', async () => {
    // Throwing here is what used to crash the TV app at launch, and a black
    // television is the one failure nobody in the room can do anything about:
    // the TV app is untouched after launch and has no remote surface at all.
    // The pairing screen says so instead — see `roomOpeningCaption`.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(launchWith(undefined)).resolves.toMatchObject({ convexClient: undefined });
  });

  it('survives a launch configured with something that is not a deployment', async () => {
    // A typo'd URL fails in the same place, for the same reason, and the fix is
    // the same edit to the same file.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(launchWith('colorful-viper-224')).resolves.toMatchObject({
      convexClient: undefined,
    });
  });

  it('leaves a note in the log for whoever installed the app', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await launchWith('');

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('EXPO_PUBLIC_CONVEX_URL');
  });
});
