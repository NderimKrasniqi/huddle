/**
 * Wraps an async operation so that it runs at most once, however many times the
 * returned function is called: the first call starts it, every later call gets
 * the same promise back.
 *
 * The TV opens a room by calling a mutation. `openRoom` is idempotent for its
 * durable TV credential, but redundant calls still spend rate-limit capacity
 * and do needless network work. A `useEffect` cannot promise "once" on its own:
 * React StrictMode runs effects twice on purpose, while Fast Refresh and
 * expo-router can both remount screens. Memoising outside React makes "once" a
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
