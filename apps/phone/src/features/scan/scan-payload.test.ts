import { describe, expect, it } from 'vitest';

import { decodeJoinQr, shouldHandleScan } from './scan-payload';

describe('join QR payload', () => {
  it('accepts only canonical Huddle join links', () => {
    expect(decodeJoinQr('huddle://join/KWRD')).toEqual({ kind: 'join', code: 'KWRD' });
    expect(decodeJoinQr(' huddle://join/kwrd ')).toEqual({ kind: 'join', code: 'KWRD' });
  });

  it.each(['https://huddle.tv/join/KWRD', 'huddle://room/KWRD', 'huddle://join/ABC', 'hello'])('rejects %s', (payload) => {
    expect(decodeJoinQr(payload)).toEqual({ kind: 'malformed' });
  });

  it('locks duplicate deliveries after the first accepted scan', () => {
    expect(shouldHandleScan(false)).toBe(true);
    expect(shouldHandleScan(true)).toBe(false);
  });
});
