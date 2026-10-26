// Must match expo.scheme in both apps' app.json.
export const JOIN_LINK_SCHEME = 'huddle';

export type LanJoin = {
  readonly hosts: readonly string[];
  readonly port: number;
  readonly tvInstanceId: string;
  readonly relay?: string;
};

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
