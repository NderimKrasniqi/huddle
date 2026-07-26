import { defineConfig } from 'vitest/config';

// One runner for the whole workspace. Convex functions need the edge runtime
// convex-test emulates the backend in; everything else (game modules, packs) is
// plain TypeScript on Node.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'convex',
          root: './convex',
          environment: 'edge-runtime',
          server: { deps: { inline: ['convex-test'] } },
        },
      },
      {
        test: {
          name: 'packages',
          include: ['packages/**/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      // The apps are mostly React Native, which tech-stack.md deliberately does
      // not test — but the plumbing under `src/` that holds an app together is
      // plain TypeScript, and that much is worth a unit test.
      {
        test: {
          name: 'apps',
          include: ['apps/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
