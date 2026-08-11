/**
 * The category value reserved for the unfiltered Host picker. Keeping this in
 * a dependency-free contract lets client-safe category metadata and the
 * server-side pack schema share the sentinel without importing one another.
 */
export const RESERVED_CATEGORY = 'all';
