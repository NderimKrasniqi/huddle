'use strict';

const {
  THEME,
  STYLE_PROP,
  unwrap,
  objectsIn,
  propertyName,
  isStyleSheetCreate,
  lookUp,
} = require('./style-objects');

/**
 * `boardwalk/tokens-only` — a Boardwalk design value is never written at a call
 * site; it is always read from a `packages/ui` token.
 *
 * Written as a lint rule rather than as a scan of the sources because the
 * question it asks is a *syntactic* one — "is this value a literal, or a
 * reference?" — and a parser answers that exactly where a regex over text
 * approximates it. It also reports on the offending line, in the editor, and
 * rides `pnpm lint`, which is already a CI gate. Its sibling guard,
 * `packages/ui/src/color-literals.test.ts`, stays a text scan because *its*
 * question is about a value ("is this hex anywhere in the repo?"), which text
 * answers perfectly and syntax would only complicate. The two compose: this one
 * catches `borderRadius: 24`, that one catches a hex smuggled through a name.
 *
 * ## Where it looks
 *
 * Style contexts only — the object passed to `StyleSheet.create`, and anything
 * inside a `style`/`…Style` JSX prop — plus `StickerSurface`'s own two shadow
 * props, `depth` and `shadowColor`, matched on that element and not on any tag
 * that happens to use those words. The walk that reaches those objects lives in
 * `style-objects.js`, shared with `boardwalk/body-text-floor` — which has to
 * reach the same places to ask an entirely different question.
 *
 * That boundary is what keeps the rule off the
 * domain: `keyArt: { color: 'punch' }` and `<NamePill color={row.color} />`
 * carry a *Player Color name*, which is protocol from game-core
 * and not a colour at all, and `depth` is an ordinary word
 * for a tree node's nesting. A rule that fired on those would be firing on the
 * vocabulary.
 *
 * ## What it guards, and what it deliberately does not
 *
 * The five classes the plan's acceptance criterion names: colours, radii,
 * border widths, shadow depths and font families. Matched by *property name*,
 * never by looking at a number, because the handoff's own measurements are
 * written as plain numbers all through this codebase — `width: 148`,
 * `gap: 18`, `paddingHorizontal: 26`, `fontSize: 88` — and a rule that fired on
 * every literal number would be a rule someone turns off. Sizes and spacing are
 * not on the list and are not touched.
 *
 * `fontWeight` is guarded as part of "font family": on this stack it is the
 * *only* other way to choose a face, and it does not work. React Native does not
 * synthesise weights for custom fonts on Android, so `fontWeight: '700'` beside
 * a loaded family is silently ignored (packages/ui/src/typography.ts) — the
 * theme's answer is `fontFamily.bodyBold`. So it is banned outright rather than
 * required to be a token: there is no weight token to point at, by design.
 *
 * Not guarded, and each for a reason rather than by oversight: sticker tilts
 * (`transform: [{ rotate }]`), `opacity` and `letterSpacing`. All three have
 * tokens and all three are used, but none is on the criterion's list, and each
 * would need its own false-positive argument first — `opacity: 0` on a hidden
 * view and `rotate: '90deg'` on a caret are not design decisions.
 *
 * ## What counts as coming from a token
 *
 * A guarded property's value must not be a literal, and where it is a plain
 * reference its value must trace back to a `@huddle/ui` import. Arithmetic is
 * judged by what it is made of, so `24 + 0` is still the literal 24 and
 * `radius.pill + 4` is a design decision wearing a token as a disguise.
 *
 * Tracing is what keeps the rule off *correct* code. A name bound inside a
 * function is data flowing through a component and is left alone — that is what
 * admits `face.fill` from an `accentFace()` call in a render body. A name bound
 * at the top of the file is followed to what it holds: `const HOST_FACE =
 * accentFace(0)` and `const BRAND = { border: colors.ink }` are as tokenised as
 * the expressions they hoist, while `const CARD_RADIUS = 24` — the likelier
 * dodge than an inline literal — is not, and is reported. Hoisting a value for
 * reuse is an ordinary thing to do; a gate that objected to it would be a gate
 * somebody switched off, which would cost more than it ever caught.
 *
 * Each class admits the one literal that means *no design value here* rather
 * than one of Boardwalk's: `0` for a radius, a border width or a shadow depth —
 * a seat with nothing to say draws `depth={news?.depth ?? 0}` — and
 * `'transparent'` for a colour, which is the same argument in the same shape
 * (`StickerSurface` draws its border that way so the fill cannot escape past
 * the ink). Neither has a token, because the system has nothing there to name.
 */

/** `color`, `backgroundColor`, `borderColor`, `shadowColor`, … */
const COLOR = /^(?:color|[A-Za-z]+Color)$/;
/** `borderRadius`, `borderTopLeftRadius`, `borderStartStartRadius`, … */
const RADIUS = /^border[A-Za-z]*Radius$/;
/** `borderWidth`, `borderTopWidth`, … — anchored on `border` so that `width`, `minWidth` and `maxWidth` are untouched. */
const BORDER_WIDTH = /^border[A-Za-z]*Width$/;

/**
 * The guarded property names, each with the `packages/ui` export that answers
 * it — named in the message so a reader is told what to use and not only what
 * not to — and the one literal that means the absence of a design value rather
 * than one of Boardwalk's.
 */
const GUARDED = [
  { matches: (name) => COLOR.test(name), token: 'colors', absence: 'transparent' },
  { matches: (name) => RADIUS.test(name), token: 'radius', absence: 0 },
  { matches: (name) => BORDER_WIDTH.test(name), token: 'borderWidth', absence: 0 },
  { matches: (name) => name === 'fontFamily', token: 'fontFamily', absence: undefined },
  { matches: (name) => name === 'depth', token: 'shadowDepth', absence: 0 },
];

/** Boardwalk's one shadow-bearing surface, and the props of it that carry a design value. */
const SHADOW_SURFACE = 'StickerSurface';
const SHADOW_PROP = /^(?:depth|shadowColor)$/;

function guardFor(name) {
  return GUARDED.find((guard) => guard.matches(name));
}

/**
 * The literal a value would resolve to, or `null` if every part of it is a
 * reference. Both branches of a conditional and both operands of an arithmetic
 * expression are checked, so neither a tokenised arm nor a `+ 0` can carry a
 * literal past.
 */
function literalIn(node, absence) {
  const value = unwrap(node);

  switch (value.type) {
    case 'Literal':
      if (typeof value.value !== 'string' && typeof value.value !== 'number') {
        return null;
      }
      return value.value === absence ? null : value;
    case 'TemplateLiteral':
      return value;
    case 'UnaryExpression':
      return value.operator === '-' || value.operator === '+'
        ? literalIn(value.argument, undefined)
        : null;
    case 'ConditionalExpression':
      return literalIn(value.consequent, absence) ?? literalIn(value.alternate, absence);
    case 'LogicalExpression':
    case 'BinaryExpression':
      return literalIn(value.left, absence) ?? literalIn(value.right, absence);
    default:
      return null;
  }
}

/** Every name a value's reference chains are rooted in. */
function rootNames(node, found) {
  const value = unwrap(node);

  switch (value.type) {
    case 'Identifier':
      found.push(value);
      break;
    case 'MemberExpression':
      rootNames(value.object, found);
      break;
    case 'CallExpression':
    case 'NewExpression':
      rootNames(value.callee, found);
      break;
    case 'ConditionalExpression':
      rootNames(value.consequent, found);
      rootNames(value.alternate, found);
      break;
    case 'LogicalExpression':
    case 'BinaryExpression':
      rootNames(value.left, found);
      rootNames(value.right, found);
      break;
    default:
      break;
  }

  return found;
}

/**
 * Where a name's value comes from.
 *
 * - `theme` — a `@huddle/ui` import, or a module-level binding that traces back
 *   to one. Fine anywhere a design value is wanted.
 * - `local` — bound inside a function, or not declared in this file at all:
 *   data flowing through a component, which the rule has no business judging.
 * - `import` — imported from somewhere that is not the theme.
 * - `declaration` — declared at the top of this file and not built from the
 *   theme, which is the one binding that can hold a design value of its own.
 */
function originOf(scope, identifier, seen) {
  const variable = lookUp(scope, identifier.name);

  if (variable === null) {
    return { kind: 'local' };
  }

  const [definition] = variable.defs;

  if (definition === undefined) {
    return { kind: 'local' };
  }

  if (definition.type === 'ImportBinding') {
    const source = String(definition.parent.source.value);
    return THEME.test(source) ? { kind: 'theme' } : { kind: 'import', source };
  }

  if (variable.scope.type !== 'module' && variable.scope.type !== 'global') {
    return { kind: 'local' };
  }

  // A cycle can only be written by code that would not run. Treat it as a value
  // of this file's own rather than following it round forever.
  if (seen.has(variable)) {
    return { kind: 'declaration' };
  }

  seen.add(variable);

  const initialiser = definition.type === 'Variable' ? definition.node.init : null;
  const tokenised =
    initialiser !== null &&
    initialiser !== undefined &&
    derivesFromTheme(variable.scope, initialiser, seen);

  return tokenised ? { kind: 'theme' } : { kind: 'declaration' };
}

/**
 * Whether every part of an expression traces back to the theme — a literal
 * anywhere in it does not, which is what makes `const CARD_RADIUS = 24`
 * distinguishable from `const ink = colors.ink`.
 *
 * `seen` stops a name being followed round forever, so it is carried *down a
 * path* and every branch gets a copy. A name read twice in one value
 * (`const BRAND = { border: ink, text: ink }`) is not a cycle, and a shared set
 * would treat the second read as a value of this file's own and report
 * Boardwalk's own token.
 */
function derivesFromTheme(scope, node, seen) {
  const value = unwrap(node);

  switch (value.type) {
    case 'Identifier':
      return originOf(scope, value, seen).kind === 'theme';
    case 'MemberExpression':
      return derivesFromTheme(scope, value.object, seen);
    case 'CallExpression':
    case 'NewExpression':
      return derivesFromTheme(scope, value.callee, seen);
    case 'ConditionalExpression':
      return (
        derivesFromTheme(scope, value.consequent, new Set(seen)) &&
        derivesFromTheme(scope, value.alternate, new Set(seen))
      );
    case 'LogicalExpression':
    case 'BinaryExpression':
      return (
        derivesFromTheme(scope, value.left, new Set(seen)) &&
        derivesFromTheme(scope, value.right, new Set(seen))
      );
    case 'ObjectExpression':
      return value.properties.every((property) =>
        derivesFromTheme(
          scope,
          property.type === 'SpreadElement' ? property.argument : property.value,
          new Set(seen),
        ),
      );
    case 'ArrayExpression':
      return value.elements.every(
        (element) => element !== null && derivesFromTheme(scope, element, new Set(seen)),
      );
    default:
      return false;
  }
}

/** Whether a JSX attribute sits on the one element whose shadow props carry design values. */
function isOnShadowSurface(attribute) {
  const element = attribute.parent;

  return (
    element !== undefined &&
    element !== null &&
    element.type === 'JSXOpeningElement' &&
    element.name.type === 'JSXIdentifier' &&
    element.name.name === SHADOW_SURFACE
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Boardwalk colours, radii, border widths, shadow depths and font families come from a packages/ui token, never from a value written at the call site.',
    },
    schema: [],
    messages: {
      literal:
        '{{property}} is Boardwalk\'s to decide: take it from `{{token}}` in @huddle/ui rather than writing {{literal}} here.',
      declaration:
        '{{property}} is Boardwalk\'s to decide: `{{name}}` is declared in this file and is not built from the theme, so take it from `{{token}}` in @huddle/ui instead.',
      imported:
        '{{property}} is Boardwalk\'s to decide: `{{name}}` comes from {{source}} rather than from the theme, so take it from `{{token}}` in @huddle/ui instead.',
      fontWeight:
        'Soft Minimal picks a font face by family, not by weight — React Native ignores `fontWeight` on a custom family on Android. Use `fontFamily.medium`, `fontFamily.semibold` or `fontFamily.bold` from @huddle/ui.',
    },
  },

  create(context) {
    const { sourceCode } = context;

    function checkValue(node, value, property, guard) {
      const literal = literalIn(value, guard.absence);

      if (literal !== null) {
        context.report({
          node,
          messageId: 'literal',
          data: {
            property: `\`${property}\``,
            token: guard.token,
            literal: sourceCode.getText(literal),
          },
        });
        return;
      }

      const scope = sourceCode.getScope(node);

      for (const root of rootNames(value, [])) {
        const origin = originOf(scope, root, new Set());

        if (origin.kind === 'theme' || origin.kind === 'local') {
          continue;
        }

        context.report({
          node,
          messageId: origin.kind === 'import' ? 'imported' : 'declaration',
          data: {
            property: `\`${property}\``,
            token: guard.token,
            name: root.name,
            source: origin.source === undefined ? 'elsewhere' : `\`${origin.source}\``,
          },
        });
        return;
      }
    }

    /** Every guarded property of a style object, wherever that object was found. */
    function checkStyleObjects(node) {
      for (const object of objectsIn(node, [])) {
        for (const property of object.properties) {
          const name = propertyName(property);

          if (name === null) {
            continue;
          }

          if (name === 'fontWeight') {
            context.report({ node: property, messageId: 'fontWeight' });
            continue;
          }

          const guard = guardFor(name);

          if (guard !== undefined) {
            checkValue(property, property.value, name, guard);
          }
        }
      }
    }

    return {
      CallExpression(node) {
        if (isStyleSheetCreate(node) && node.arguments.length > 0) {
          checkStyleObjects(node.arguments[0]);
        }
      },

      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.value === null) {
          return;
        }

        const name = node.name.name;

        if (STYLE_PROP.test(name)) {
          checkStyleObjects(node.value);
          return;
        }

        if (!SHADOW_PROP.test(name) || !isOnShadowSurface(node)) {
          return;
        }

        const guard = guardFor(name);
        const value =
          node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value;

        if (guard !== undefined && value.type !== 'JSXEmptyExpression') {
          checkValue(node, value, name, guard);
        }
      },
    };
  },
};
