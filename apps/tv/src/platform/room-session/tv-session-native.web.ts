import { TV_SESSION_TOKEN_KEY, type TvSessionStore } from './tv-session';

type Browser = {
  readonly localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  readonly crypto: { randomUUID(): string };
};
const browser = globalThis as unknown as Browser;

/**
 * The web TV's durable identity: `localStorage` in place of the Keychain. A
 * TV browser has no secure store; the token only proves this TV to its own
 * room host in the same page.
 */
export const secureTvSessionStore: TvSessionStore = {
  read: async () => {
    try {
      return browser.localStorage?.getItem(TV_SESSION_TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  },
  write: async (token) => {
    try {
      browser.localStorage?.setItem(TV_SESSION_TOKEN_KEY, token);
    } catch {
      // Without storage the TV gets a new token next launch, as on first run.
    }
  },
};

export const nativeTvSessionUuid = (): string => browser.crypto.randomUUID();
