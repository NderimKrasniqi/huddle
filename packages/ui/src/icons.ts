/**
 * The Soft Minimal icon set, as geometry.
 *
 * Every icon is a 24×24 line drawing transcribed from the delivered SVG source
 * in `packages/ui/assets/icons/`, which is committed beside this file as the
 * provenance record. `icons.test.ts` parses those files and fails if any shape
 * here has drifted from its source, so the two cannot come apart quietly.
 *
 * ## Why geometry and not artwork
 *
 * The package also shipped each icon as a PNG twice — a dark set for light
 * surfaces and a white set for coloured ones — and neither is used. An icon
 * that is a path is one file that is sharp at 14pt on a phone and at 48pt on a
 * television, and takes its colour from a token at the call site rather than
 * from which folder it was imported out of. Two raster sets would have been two
 * things to keep in step and still wrong on the third surface.
 *
 * Colour is therefore deliberately absent here. The sources carry `#1C2428`
 * strokes and a `#FF5C3A` crown; both are the package's own approximations of
 * `colors.ink` and `colors.accent`, and neither is transcribed — `Icon` takes
 * the colour as a prop so the palette stays in `colors.ts` alone.
 *
 * ## What is deliberately *not* here
 *
 * The delivered set also held `badge_host`, `badge_just-joined` and three
 * status dots. They are not icons: a badge is a bordered chip with a word in
 * it and a dot is a filled circle, and both are drawn here as ordinary React
 * Native views so they scale with their text and take their colour from the
 * palette. Shipping them as images would have baked a font, a border radius and
 * a colour into a bitmap that a phone and a television need at different sizes.
 * Only the crown — a glyph *inside* the HOST chip — is kept.
 */

/** One drawn shape of an icon, in the source's own document order. */
export type IconShape =
  | {
      readonly kind: 'path';
      readonly d: string;
      /** Filled with the icon's colour instead of stroked. */
      readonly filled?: boolean;
    }
  | {
      readonly kind: 'circle';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly filled?: boolean;
    }
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx?: number;
    };

/** An icon: the shapes it is made of, and how heavy its strokes are. */
export type IconGeometry = {
  readonly shapes: readonly IconShape[];
  /** In viewBox units. The set draws at 2.2 except where a source says otherwise. */
  readonly strokeWidth: number;
};

/**
 * The side of every icon's viewBox. One number rather than a per-icon field
 * because the whole set is square and 24, and an icon that were not would not
 * line up beside the others at the same rendered size anyway.
 */
export const ICON_VIEWBOX = 24;

/** The set's stroke weight, in viewBox units. */
const STROKE = 2.2;

/**
 * `as const` so the keys are literals and `IconName` can be read off them —
 * but the literal *values* it also produces are useless here, since they
 * narrow every shape to its own exact object and lose the optional `filled`
 * and `rx` that `IconShape` declares. `ICONS` below re-exposes it at the
 * declared type, so callers see one shape union rather than forty.
 */
const ICON_SET = {
  'arrow-left': {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'path', d: 'M19 12H5' },
      { kind: 'path', d: 'm10 7-5 5 5 5' },
    ],
  },
  'arrow-right': {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'path', d: 'M5 12h14' },
      { kind: 'path', d: 'm14 7 5 5-5 5' },
    ],
  },
  check: {
    strokeWidth: STROKE,
    shapes: [{ kind: 'path', d: 'm5 12 4 4L19 6' }],
  },
  'chevron-left': {
    strokeWidth: STROKE,
    shapes: [{ kind: 'path', d: 'm15 18-6-6 6-6' }],
  },
  'chevron-right': {
    strokeWidth: STROKE,
    shapes: [{ kind: 'path', d: 'm9 18 6-6-6-6' }],
  },
  clock: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'circle', cx: 12, cy: 12, r: 9 },
      { kind: 'path', d: 'M12 7v5l3 2' },
    ],
  },
  // The one filled icon, and the one that sets its own weight: its source draws
  // the crown as a solid shape over a 2-unit rule rather than as outline.
  crown: {
    strokeWidth: 2,
    shapes: [
      { kind: 'path', d: 'M4 18h16l-1.1-9-4.3 3.5L12 6l-2.6 6.5L5.1 9 4 18Z', filled: true },
      { kind: 'path', d: 'M6 20h12' },
    ],
  },
  gamepad: {
    strokeWidth: STROKE,
    shapes: [
      {
        kind: 'path',
        d: 'M7 9h10a5 5 0 0 1 4.7 6.7l-1 2.6a2 2 0 0 1-3.2.8l-2.2-1.8H8.7l-2.2 1.8a2 2 0 0 1-3.2-.8l-1-2.6A5 5 0 0 1 7 9Z',
      },
      { kind: 'path', d: 'M8 12v4M6 14h4' },
      { kind: 'circle', cx: 16.5, cy: 13, r: 1 },
      { kind: 'circle', cx: 18.5, cy: 15, r: 1 },
    ],
  },
  phone: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'rect', x: 7, y: 2.5, width: 10, height: 19, rx: 2 },
      { kind: 'path', d: 'M10 5h4' },
      // The home button: solid in the source, where every other shape is line.
      { kind: 'circle', cx: 12, cy: 18.5, r: 0.7, filled: true },
    ],
  },
  'player-count': {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'circle', cx: 9, cy: 9, r: 2.5 },
      { kind: 'circle', cx: 16, cy: 10, r: 2 },
      { kind: 'path', d: 'M4 18a5 5 0 0 1 10 0' },
      { kind: 'path', d: 'M13 17.5a4 4 0 0 1 7 0' },
    ],
  },
  players: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'circle', cx: 9, cy: 8, r: 3 },
      { kind: 'circle', cx: 17, cy: 9, r: 2.5 },
      { kind: 'path', d: 'M3.5 19a5.5 5.5 0 0 1 11 0' },
      { kind: 'path', d: 'M13.5 18a4.5 4.5 0 0 1 7 0' },
    ],
  },
  scan: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'path', d: 'M4 9V5a1 1 0 0 1 1-1h4' },
      { kind: 'path', d: 'M15 4h4a1 1 0 0 1 1 1v4' },
      { kind: 'path', d: 'M20 15v4a1 1 0 0 1-1 1h-4' },
      { kind: 'path', d: 'M9 20H5a1 1 0 0 1-1-1v-4' },
      { kind: 'rect', x: 8, y: 8, width: 3, height: 3 },
      { kind: 'rect', x: 13, y: 13, width: 3, height: 3 },
    ],
  },
  tag: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'path', d: 'M20 13 13 20 4 11V4h7l9 9Z' },
      { kind: 'circle', cx: 8.5, cy: 8.5, r: 1 },
    ],
  },
  trash: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'path', d: 'M4 7h16' },
      { kind: 'path', d: 'M9 7V4h6v3' },
      { kind: 'path', d: 'M7 7l1 13h8l1-13' },
      { kind: 'path', d: 'M10 11v5M14 11v5' },
    ],
  },
  tv: {
    strokeWidth: STROKE,
    shapes: [
      { kind: 'rect', x: 3, y: 5, width: 18, height: 12, rx: 2 },
      { kind: 'path', d: 'M8 21h8' },
      { kind: 'path', d: 'M12 17v4' },
    ],
  },
} as const satisfies Readonly<Record<string, IconGeometry>>;

/** The name of an icon in the set. */
export type IconName = keyof typeof ICON_SET;

/** The set, at the type callers want: a name to a drawing. */
export const ICONS: Readonly<Record<IconName, IconGeometry>> = ICON_SET;
