import { describe, expect, it } from 'vitest';

import {
  PHONE_FIXTURE_VIEWPORT,
  PHONE_REFERENCE_FIXTURES,
  TV_FIXTURE_VIEWPORT,
  TV_REFERENCE_FIXTURES,
} from './manifest';

describe('visual fixture inventory awaiting individual approval', () => {
  it('keeps the canonical Phone viewport with no unapproved references', () => {
    expect(PHONE_FIXTURE_VIEWPORT).toEqual({ width: 393, height: 852 });
    expect(PHONE_REFERENCE_FIXTURES).toEqual([]);
  });

  it('keeps the canonical TV viewport with no unapproved references', () => {
    expect(TV_FIXTURE_VIEWPORT).toEqual({ width: 1672, height: 941 });
    expect(TV_REFERENCE_FIXTURES).toEqual([]);
  });
});
