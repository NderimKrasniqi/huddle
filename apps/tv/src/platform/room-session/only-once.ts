export function onlyOnce<T>(operation: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  async function attempt(): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      inFlight = null;
      throw error;
    }
  }

  return () => {
    inFlight ??= attempt();
    return inFlight;
  };
}
