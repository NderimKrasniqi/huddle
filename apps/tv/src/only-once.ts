/**
 * Wraps an async operation so that it runs at most once, however many times the
 * returned function is called: the first call starts it, every later call gets
 * the same promise back.
 *
 * The TV opens a room by calling a mutation, and a mutation is not idempotent —
 * calling it twice mints two rooms and shows the wrong code on one of them. A
 * `useEffect` cannot promise "once" on its own: React StrictMode runs effects
 * twice on purpose, Fast Refresh and expo-router both remount screens, and each
 * of those would be another room. Memoising outside React makes "once" a
 * property of the app launch instead of a property of a render.
 */
export function onlyOnce<T>(operation: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  async function attempt(): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // A failure must not become this launch's permanent answer: forgetting it
      // lets the next caller — a remount, a retry — have another go.
      inFlight = null;
      throw error;
    }
  }

  return () => {
    inFlight ??= attempt();
    return inFlight;
  };
}
