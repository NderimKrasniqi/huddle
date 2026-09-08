/**
 * Canonical visual-fixture viewports for the app interior.
 *
 * Reference arrays are intentionally empty until each screen is individually
 * designed and approved. Keeping the capture viewport here prevents a bezel
 * or system chrome from silently becoming part of a future parity comparison.
 */

export const PHONE_FIXTURE_VIEWPORT = { width: 393, height: 852 } as const;
export const TV_FIXTURE_VIEWPORT = { width: 1672, height: 941 } as const;

export const PHONE_REFERENCE_FIXTURES = [] as const;

export const TV_REFERENCE_FIXTURES = [] as const;
