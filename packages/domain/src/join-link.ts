/**
 * The Join Link: the deep link that puts a phone into a room. The TV encodes it
 * in the QR on its pairing screen; the Phone registers the scheme and
 * opens the join screen with the code prefilled.
 *
 * It lives beside the Room Code format because it is protocol, not decoration —
 * one side builds the string and the other parses it, and they must agree.
 */

/**
 * The URL scheme both apps register. It is duplicated in each app's `app.json`
 * (`expo.scheme`), which the native projects are generated from and which this
 * package cannot reach into; `join-link.test.ts` asserts the two never drift.
 */
export const JOIN_LINK_SCHEME = 'huddle';

/**
 * Where a phone finds a TV that hosts its own room (ADR-01): the TV's IPv4
 * addresses in the order to try them, its port, and the TV instance id that
 * keys the phone's saved Session Token. `relay` is the relay's base URL when
 * the TV is also registered there (ADR-03); the phone tries it after the
 * addresses. A TV that cannot listen at all has no hosts, only the relay.
 */
export type LanJoin = {
  readonly hosts: readonly string[];
  readonly port: number;
  readonly tvInstanceId: string;
  readonly relay?: string;
};

/**
 * The Join Link for a room, e.g. `huddle://join/KWRD`, or with the TV's LAN
 * address when the TV hosts the room:
 * `huddle://join/KWRD?hosts=192.168.1.20&port=7777&tv=tv_abc`, plus
 * `&relay=wss%3A%2F%2Frelay.example` when the TV is on the relay.
 */
export function roomJoinLink(code: string, lan?: LanJoin): string {
  const base = `${JOIN_LINK_SCHEME}://join/${code}`;
  if (lan === undefined) return base;
  const query = [
    `hosts=${lan.hosts.map(encodeURIComponent).join(',')}`,
    `port=${lan.port}`,
    `tv=${encodeURIComponent(lan.tvInstanceId)}`,
    ...(lan.relay === undefined ? [] : [`relay=${encodeURIComponent(lan.relay)}`]),
  ].join('&');
  return `${base}?${query}`;
}

/**
 * The code and, when present, the LAN address in a Join Link. `undefined` for
 * anything that is not one; the code is returned as written, for the caller to
 * normalise and check.
 */
export function parseRoomJoinLink(link: string): { readonly code: string; readonly lan?: LanJoin } | undefined {
  const match = new RegExp(`^${JOIN_LINK_SCHEME}://join/([^/?#]+)(?:\\?([^#]*))?$`, 'u').exec(link.trim());
  if (match === null) return undefined;
  const code = match[1] ?? '';
  const params = new Map(
    (match[2] ?? '')
      .split('&')
      .filter((pair) => pair.includes('='))
      .map((pair) => {
        const at = pair.indexOf('=');
        return [pair.slice(0, at), safeDecode(pair.slice(at + 1))] as const;
      }),
  );
  const hosts = (params.get('hosts') ?? '').split(',').map(safeDecode).filter((host) => host !== '');
  const port = Number(params.get('port'));
  const tvInstanceId = params.get('tv') ?? '';
  const relay = params.get('relay') ?? '';
  const onRelay = /^wss?:\/\/[^\s]+$/u.test(relay);
  const onLan = hosts.length > 0 && Number.isInteger(port) && port > 0 && port < 65_536;
  const lan =
    (onLan || onRelay) && tvInstanceId !== ''
      ? { hosts: onLan ? hosts : [], port: onLan ? port : 0, tvInstanceId, ...(onRelay ? { relay } : {}) }
      : undefined;
  return lan === undefined ? { code } : { code, lan };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
