/* global jest */

// Native storage modules are unavailable in Jest's Node runtime. Keep the
// platform adapters importable so render tests can exercise their callers.
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// JoinForm is a route adapter; its Convex hooks are mocked in render tests so
// those tests can focus on the form handoff without constructing a websocket.
jest.mock('convex/react', () => {
  const actual = jest.requireActual('convex/react');
  return {
    ...actual,
    useMutation: () => jest.fn(),
    useQuery: () => null,
  };
});
