# Tech Stack

Record only choices this project actually needs.

## Stack

| Area | Choice | Why |
|---|---|---|
| Language | TypeScript | One language across phone, TV, shared game contracts, and backend. |
| Mobile | Expo SDK 57 + React Native 0.86 | Native iOS/Android with shared implementation. |
| TV | `react-native-tvos@0.86-stable` | Android TV support while remaining compatible with normal mobile targets. |
| Navigation | Expo Router | Shared Expo-native navigation model. |
| Styling | NativeWind v4 stable | Utility-first styling with React Native/TV support without adopting preview v5. |
| Backend/realtime | Convex | Authoritative room/game state, reactive queries, transactional mutations, and scheduled functions without a separate API or realtime service. |
| Local preferences | AsyncStorage | Last-used name, avatar, and other non-sensitive convenience preferences. |
| Session credential storage | Expo SecureStore | Protect participant/session credentials used for reconnection and authorization. |
| Workspace | pnpm workspaces | Simple monorepo sharing without Turborepo/Nx. |
| Backend tests | Vitest + `convex-test` | Convex/domain tests, fake time, lifecycle and scheduled-function verification. |
| Client tests | Jest + `jest-expo` + React Native Testing Library | Expo/React Native UI and interaction tests. |
| Builds | Local Expo/native builds | MVP development and verification without EAS Build infrastructure. |

## Architecture

- Convex is the authoritative source of room and game state.
- Clients send intentions through validated mutations; clients do not decide authoritative state.
- Reactive queries expose only the state each surface needs.
- Games depend on a platform game contract; platform/session infrastructure does not depend on Trivia-specific logic.
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
install: pnpm install
typecheck: pnpm typecheck
backend tests: pnpm test:backend
client tests: pnpm test:client
android phone: pnpm mobile:android
ios phone: pnpm mobile:ios
android tv: pnpm tv:android
convex check/push: pnpm convex:check
```
