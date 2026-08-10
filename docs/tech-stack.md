# Tech Stack

Record only choices this project actually needs.

## Stack

| Area | Choice | Why |
|---|---|---|
| Language | TypeScript | One language across phone, TV, shared game contracts, and backend. |
| Mobile | Expo SDK 57 + React Native 0.86 | Native iOS/Android with shared implementation. |
| TV | `react-native-tvos@0.86-stable` | Android TV support while remaining compatible with normal mobile targets. |
| Navigation | Expo Router | Shared Expo-native navigation model. |
| Styling | Soft Minimal design tokens + React Native `StyleSheet` | A shared design-token system in `@huddle/ui` (colors, typography, motion, shadows, shape) consumed through `StyleSheet`, verified for Android TV legibility through Phase 5. NativeWind was evaluated and not adopted; its v4 behavior on Android TV was an open risk and the token system already met the approved Soft Minimal handoff. |
| Backend/realtime | Convex | Authoritative room/game state, reactive queries, transactional mutations, and scheduled functions without a separate API or realtime service. |
| Local preferences | AsyncStorage | Last-used name, avatar, and other non-sensitive convenience preferences. |
| Session credential storage | Expo SecureStore | Protect participant/session credentials used for reconnection and authorization. |
| Workspace | pnpm workspaces | Simple monorepo sharing without Turborepo/Nx. |
| Backend tests | Vitest + `convex-test` | Convex/domain tests, fake time, lifecycle and scheduled-function verification. |
| Client tests | Vitest (node) over extracted logic modules | App behaviour is factored into pure modules (`apps/*/src/*.ts`) and tested with Vitest in a node environment. React Native Testing Library component-rendering tests are out of MVP scope. |
| Builds | Local Expo/native builds | MVP development and verification without EAS Build infrastructure. |

## Architecture

- Convex is the authoritative source of room and game state.
- Clients send intentions through validated mutations; clients do not decide authoritative state.
- Reactive queries expose only the state each surface needs.
- Client game modules and server game logic meet through separate registry entrypoints; platform/session infrastructure does not depend on Trivia-specific logic.
- Expo route adapters contain no implementation, and app features/platform owners expose explicit entrypoints; cross-owner deep imports are rejected by workflow validation.
- Private player state is returned only to the participant entitled to see it.
- The room code locates a room; it is never sufficient authorization.
- Participant/session credentials are stored in SecureStore and validated server-side.
- Timers store authoritative timestamps and use scheduled functions for state transitions; clients render countdowns locally.
- Presence uses heartbeat/last-seen state plus grace periods; brief backgrounding is not an immediate disconnect.
- Do not duplicate Convex server state in Zustand or another client store without a demonstrated client-only need.
- All Expo apps in the monorepo use the matching `react-native-tvos` React Native fork to avoid dependency conflicts.
- Do not add a separate API server, WebSocket gateway, PostgreSQL, Redis, EAS Build, Docker/Kubernetes, or authentication provider unless future requirements justify them.

## Verification

```text
install:              pnpm install
typecheck:            pnpm typecheck            # root tsc + every workspace
lint:                 pnpm lint
all tests:            pnpm test                 # convex + packages + apps + lint-rules (Vitest)
unit tests:           pnpm test:unit            # packages + apps + lint-rules
backend/integration:  pnpm test:integration     # convex (edge-runtime)
pack validation:      pnpm validate:packs
workflow/architecture: pnpm validate:workflow
controller export:     pnpm --filter @huddle/controller exec expo export --platform ios --output-dir <temporary-directory>
tv export:             pnpm --filter @huddle/tv exec expo export --platform ios --output-dir <temporary-directory>
tv native generation: pnpm --filter @huddle/tv prebuild --platform android --no-install
android tv:           pnpm --filter @huddle/tv android
android phone:        pnpm --filter @huddle/controller android
ios phone:            pnpm --filter @huddle/controller ios
convex dev:           pnpm --filter @huddle/convex dev
```
