import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_VIEWBOX, ICONS, type IconShape } from './icons';

/**
 * `icons.ts` against the SVG files it was transcribed from.
 *
 * The geometry is written out in TypeScript so it can be rendered without an
 * SVG loader in the bundler, which means there are two copies of every path in
 * this repo — and a second copy nobody checks is a second copy that goes wrong.
 * So this parses the delivered sources and holds the transcription to them,
 * shape for shape and in document order.
 *
 * It is a regex parser rather than a real one on purpose. These files are
 * machine-generated, single-line, and use six attributes between them; a
 * dependency that could parse arbitrary SVG would be a large answer to a
 * question this small. The cost is that a *hand-edited* source could grow
 * syntax this does not read — which the first assertion catches, because an
 * unparsed shape is a missing shape rather than a passing one.
 */

const iconsDirectory = path.join(import.meta.dirname, '../assets/icons');

/** Every `<path>`, `<circle>` and `<rect>` in the file, in the order drawn. */
const SHAPE = /<(path|circle|rect)\b([^>]*)>/gu;

/** One attribute's value, for the handful of attributes these files carry. */
function attribute(attributes: string, name: string): string | undefined {
  const found = new RegExp(`\\b${name}="([^"]*)"`, 'u').exec(attributes);

  return found?.[1];
}

function number(attributes: string, name: string): number | undefined {
  const raw = attribute(attributes, name);

  return raw === undefined ? undefined : Number(raw);
}

/**
 * Whether a shape is painted solid. The sources say it two ways — an explicit
 * `fill` that is not `none` on the shape, against the root's `fill="none"` —
 * and both mean the same thing here.
 */
function isFilled(attributes: string): boolean {
  const fill = attribute(attributes, 'fill');

  return fill !== undefined && fill !== 'none';
}

/** The shapes an SVG source draws, in the shape `icons.ts` records them. */
function shapesOf(source: string): IconShape[] {
  return [...source.matchAll(SHAPE)].map((match) => {
    // Both groups are required by the pattern, so neither can be absent on a
    // match; TypeScript types every group as optional regardless.
    const tag = match[1] ?? '';
    const attributes = match[2] ?? '';

    switch (tag) {
      case 'path':
        return { kind: 'path', d: attribute(attributes, 'd') ?? '', filled: isFilled(attributes) };
      case 'circle':
        return {
          kind: 'circle',
          cx: number(attributes, 'cx') ?? 0,
          cy: number(attributes, 'cy') ?? 0,
          r: number(attributes, 'r') ?? 0,
          filled: isFilled(attributes),
        };
      default:
        return {
          kind: 'rect',
          x: number(attributes, 'x') ?? 0,
          y: number(attributes, 'y') ?? 0,
          width: number(attributes, 'width') ?? 0,
          height: number(attributes, 'height') ?? 0,
          rx: number(attributes, 'rx'),
        };
    }
  }) as IconShape[];
}

/**
 * The transcription in the same normal form the parser produces: `filled` and
 * `rx` are optional in the source data and absent rather than false/undefined,
 * so both sides are levelled before they are compared.
 */
function normalised(shape: IconShape): IconShape {
  switch (shape.kind) {
    case 'path':
      return { kind: 'path', d: shape.d, filled: shape.filled === true };
    case 'circle':
      return { ...shape, filled: shape.filled === true };
    default:
      return { ...shape, rx: shape.rx };
  }
}

const sources = readdirSync(iconsDirectory).filter((file) => file.endsWith('.svg'));

describe('the icon set', () => {
  it('has a source file for every icon and an icon for every source file', () => {
    // Neither direction is harmless. An icon with no source is one nobody can
    // check; a source with no icon is artwork that was delivered and dropped.
    expect([...sources].sort()).toEqual(
      Object.keys(ICONS)
        .map((name) => `${name}.svg`)
        .sort(),
    );
  });

  it('draws every source with shapes this file can actually read', () => {
    // The parser knows three elements. A re-delivered source that used a
    // `line`, a `polyline`, an `ellipse` or a `<g>` would be *silently* dropped
    // by it — and dropped by whoever transcribed it too, so the shape-for-shape
    // case below would agree with itself about an icon missing a stroke. This
    // is the assertion that makes an unknown element a failure instead.
    const READABLE = new Set(['svg', 'path', 'circle', 'rect']);

    for (const file of sources) {
      const source = readFileSync(path.join(iconsDirectory, file), 'utf8');
      const unreadable = [...source.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/gu)]
        .map(([, tag]) => tag ?? '')
        .filter((tag) => !READABLE.has(tag));

      expect(unreadable, file).toEqual([]);
    }
  });

  it('draws every source at 24, which is what lets them line up beside each other', () => {
    for (const file of sources) {
      const source = readFileSync(path.join(iconsDirectory, file), 'utf8');

      expect(attribute(source, 'viewBox'), file).toBe(`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`);
    }
  });

  it.each(Object.keys(ICONS))('transcribes %s shape for shape', (name) => {
    const source = readFileSync(path.join(iconsDirectory, `${name}.svg`), 'utf8');
    const geometry = ICONS[name as keyof typeof ICONS];

    const drawn = shapesOf(source);

    // Without this a parser that read nothing would agree with a transcription
    // of nothing, and every case here would pass on an empty file.
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).toEqual(geometry.shapes.map(normalised));
  });

  it('takes each source’s own stroke weight', () => {
    for (const [name, geometry] of Object.entries(ICONS)) {
      const source = readFileSync(path.join(iconsDirectory, `${name}.svg`), 'utf8');
      // The weight sits on the root for the outline icons and on the one
      // stroked shape of the filled one, so the first occurrence is the icon's.
      const declared = /stroke-width="([^"]*)"/u.exec(source)?.[1];

      expect(Number(declared), name).toBe(geometry.strokeWidth);
    }
  });

  it('holds no colour, which is the whole reason it is geometry', () => {
    // The sources carry the package's approximations of ink and accent. If one
    // is ever transcribed, this file becomes a second palette — and
    // `color-literals.test.ts` cannot catch it, since `packages/ui/src` is
    // exempt from that rule by design.
    expect(JSON.stringify(ICONS)).not.toMatch(/#[0-9a-fA-F]{3,8}/u);
  });
});
