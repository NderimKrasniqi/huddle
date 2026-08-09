import { Circle, Path, Rect, Svg } from 'react-native-svg';

import { ICON_VIEWBOX, ICONS, type IconName } from '../icons';

/**
 * One icon from the Soft Minimal set, drawn at any size in any colour.
 *
 * The geometry is in `icons.ts` and the palette is in `colors.ts`, and this is
 * the only thing that holds both. It takes `color` rather than reading a token
 * itself because the same glyph is ink on a white card, white on the orange
 * primary, and accent inside the HOST chip — three surfaces, one drawing.
 *
 * `size` is the rendered square in design points; the 24-unit viewBox scales to
 * it, which is what makes a 14pt chip glyph on a phone and a 48pt one on a
 * television the same file rather than two exports of it. Strokes scale with
 * the box, so a large icon is a heavier line and not a thin one stretched — the
 * behaviour the source drawings assume.
 *
 * ## Not focusable, and not spoken by default
 *
 * Every icon in this product sits beside the words it illustrates: the crown is
 * next to HOST, the trash is on a button that says Remove. So the default is
 * `accessibilityElementsHidden` — a screen reader that read both would say
 * "crown, HOST". Pass `label` for the rare icon that carries meaning nothing
 * beside it repeats, and it becomes an image with that label instead.
 *
 * It renders `Svg`, which is not in `huddle/tv-remote-surface`'s focusable list
 * and is not focusable on tvOS: it draws, it does not take input.
 */
export type IconProps = {
  readonly name: IconName;
  /** The rendered square, in design points. */
  readonly size: number;
  /** Any colour; pass a `colors` token rather than a literal. */
  readonly color: string;
  /**
   * What a screen reader should call it. Omit — the default — for an icon whose
   * meaning is already in the text beside it, which is nearly all of them.
   */
  readonly label?: string;
};

export function Icon({ name, size, color, label }: IconProps) {
  const { shapes, strokeWidth } = ICONS[name];

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      // Decoration unless it is given a name — see the note above.
      accessibilityRole={label === undefined ? 'none' : 'image'}
      accessibilityLabel={label}
      accessibilityElementsHidden={label === undefined}
      importantForAccessibility={label === undefined ? 'no-hide-descendants' : 'yes'}
    >
      {shapes.map((shape, index) => {
        // The shapes of one icon are a fixed list in source order and are never
        // reordered, inserted into, or keyed by identity — the index is the
        // stable identity here.
        const key = `${shape.kind}-${index}`;
        // A solid shape takes the colour as fill and draws no outline; an
        // outline shape is the reverse. Nothing in the set is both. Rectangles
        // are outline-only by construction — `IconShape` gives them no `filled`
        // — because the two in the set are the scan icon's register marks.
        const paint = shape.kind !== 'rect' && shape.filled === true
          ? { fill: color }
          : {
              fill: 'none' as const,
              stroke: color,
              strokeWidth,
              strokeLinecap: 'round' as const,
              strokeLinejoin: 'round' as const,
            };

        switch (shape.kind) {
          case 'path':
            return <Path key={key} d={shape.d} {...paint} />;
          case 'circle':
            return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} />;
          default:
            return (
              <Rect
                key={key}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={shape.rx}
                {...paint}
              />
            );
        }
      })}
    </Svg>
  );
}
