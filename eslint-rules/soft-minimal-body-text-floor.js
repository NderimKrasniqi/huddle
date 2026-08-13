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
 * `soft-minimal/body-text-floor` — body text is never set below the smallest size
 * the surface it is read on allows.
 *
 * The handoff pins one number per surface: "TV minimums: body text ≥ 18px at
 * 1280×720 design size", and 14px for a phone read from the hand. `packages/ui`
 * holds both (`minBodyFontSize`), and the TV screens already use the TV one in
 * four places. What was missing is the thing that fails when a fifth size is
 * added under it.
 *
 * ## Why this is not an option on `soft-minimal/tokens-only`
 *
 * The sibling rule's whole boundary is that it keys on a property's *name* and
 * never on its value — that is what lets the handoff's measurements stay plain
 * numbers (`width: 148`, `gap: 18`, `fontSize: 88`) without a gate objecting to
 * them. This rule is the exact opposite: `fontSize` is always allowed to be a
 * number, and the only question is which number. Folding the two together would
 * contradict the one sentence that makes either of them defensible. They share
 * the walk to a style object (`style-objects.js`) and nothing else.
 *
 * ## Which surface a file stands on
 *
 * Not the rule's question — the flat config's, which is what ESLint's `files`
 * is for. `eslint.config.js` switches this on twice: `apps/tv` and a game
 * module's `tv-*` screens with `surface: 'tv'`, `apps/phone` and a
 * module's `phone-*` screens with `surface: 'phone'`. Two blocks and not
 * one repo-wide number, because 18 and 14 are two floors rather than a strict
 * one and a lax one — a repo-wide 18 would be the television's number written
 * over the phone's, and a repo-wide 14 would un-ban on the television
 * everything the TV block exists to catch. A file on neither surface —
 * `packages/ui`, which both clients import — gets no floor, because a shared
 * primitive stands on no one reading distance.
 *
 * The whole `minBodyFontSize` table is passed in rather than the one number, so
 * that `minBodyFontSize.phone` written on a television — a phone screen ported
 * to the TV, keeping the floor it was authored against — is a size the rule can
 * read rather than an opaque reference it has to wave through.
 *
 * ## What counts as body text
 *
 * Everything with a `fontSize`. There is no exemption, because there is nothing
 * left to exempt: the floors are the smallest sizes on the handoff's own scale
 * (phone caption 12, TV caption 16), so every size the design system specifies
 * already clears them.
 *
 * Soft Minimal needed one. Its floors were 14 and 18 while the Phone drew its
 * HOST pill in Bungee at 13, so anything set in `fontFamily.display` was waved
 * through as "drawing type, not setting a sentence". Soft Minimal has no
 * display face — the wordmark ships as artwork and everything else is Inter at
 * a weight — so that escape hatch had neither a claimant nor a way to be
 * claimed, and it went with the face it named.
 *
 * ## What it does not catch
 *
 * A `<Text>` with no size anywhere in its style chain renders at React Native's
 * own 14px default, which is invisible here — finding it would mean resolving
 * style names across files. That default is under the TV floor and *is* the
 * phone floor, so only the television is exposed by the gap. Every `<Text>` on
 * all four surfaces either carries a sized style or is nested in one that does,
 * and that is a fact checked by reading rather than by this gate. A size
 * arriving as a prop, or from another module, is likewise unjudgeable and
 * passes.
 */

/** The theme export this rule has to recognise. */
const FLOOR_TOKEN = 'minBodyFontSize';

/**
 * Whether a name really is the `@huddle/ui` export called `token`, followed
 * through a module-level alias for it.
 *
 * Keyed on what was *imported* rather than on the local name, so
 * `import { minBodyFontSize as floors }` is still the token and a local
 * `const minBodyFontSize = { phone: 4 }` is not. An exemption granted on the
 * *shape* of a name would be no gate at all.
 */
function isThemeToken(scope, node, token, seen) {
  const value = unwrap(node);

  if (value.type !== 'Identifier') {
    return false;
  }

  const variable = lookUp(scope, value.name);

  if (variable === null || seen.has(variable)) {
    return false;
  }

  seen.add(variable);

  const [definition] = variable.defs;

  if (definition === undefined) {
    return false;
  }

  if (definition.type === 'ImportBinding') {
    return (
      THEME.test(String(definition.parent.source.value)) &&
      definition.node.type === 'ImportSpecifier' &&
      definition.node.imported.type === 'Identifier' &&
      definition.node.imported.name === token
    );
  }

  if (definition.type !== 'Variable' || variable.scope.type !== 'module') {
    return false;
  }

  const initialiser = definition.node.init;

  return (
    initialiser !== null &&
    initialiser !== undefined &&
    isThemeToken(variable.scope, initialiser, token, seen)
  );
}

/**
 * The number a size expression comes out at, or `null` where the rule cannot
 * say — a value arriving as a prop, from another module, or through anything
 * more than the arithmetic below.
 *
 * Arithmetic is folded rather than waved through as "an expression", for the
 * reason its sibling folds it: `minBodyFontSize.tv - 2` is the whole dodge, and
 * it costs a developer four characters.
 *
 * `seen` stops a name being followed round forever, so it is carried *down a
 * path* and branches get a copy each. A name read twice in one expression
 * (`HALF + HALF`) is not a cycle, and a shared set would make the second read
 * unresolvable and wave the whole size through.
 */
function sizeOf(scope, node, floors, seen) {
  const value = unwrap(node);

  switch (value.type) {
    case 'Literal':
      return typeof value.value === 'number' ? value.value : null;

    case 'UnaryExpression': {
      const operand = sizeOf(scope, value.argument, floors, seen);

      if (operand === null || (value.operator !== '-' && value.operator !== '+')) {
        return null;
      }

      return value.operator === '-' ? -operand : operand;
    }

    case 'BinaryExpression': {
      const left = sizeOf(scope, value.left, floors, new Set(seen));
      const right = sizeOf(scope, value.right, floors, new Set(seen));

      if (left === null || right === null) {
        return null;
      }

      switch (value.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right === 0 ? null : left / right;
        default:
          return null;
      }
    }

    // Whichever arm the screen takes, it has to clear the floor — so the
    // smaller of the two is what gets judged.
    case 'ConditionalExpression': {
      const consequent = sizeOf(scope, value.consequent, floors, new Set(seen));
      const alternate = sizeOf(scope, value.alternate, floors, new Set(seen));

      if (consequent === null) {
        return alternate;
      }
      if (alternate === null) {
        return consequent;
      }

      return Math.min(consequent, alternate);
    }

    case 'MemberExpression': {
      if (value.computed || value.property.type !== 'Identifier') {
        return null;
      }

      return isThemeToken(scope, value.object, FLOOR_TOKEN, new Set())
        ? (floors[value.property.name] ?? null)
        : null;
    }

    case 'Identifier': {
      const variable = lookUp(scope, value.name);

      if (variable === null || seen.has(variable)) {
        return null;
      }

      seen.add(variable);

      const [definition] = variable.defs;

      // A name bound inside a component is data flowing through it, and a name
      // this file never declared is somebody else's. Only a module-level
      // constant is followed — the same line its sibling draws, for the same
      // reason: hoisting a size out of a style sheet is the likelier dodge than
      // writing the number inline.
      if (
        definition === undefined ||
        definition.type !== 'Variable' ||
        variable.scope.type !== 'module'
      ) {
        return null;
      }

      const initialiser = definition.node.init;

      return initialiser === null || initialiser === undefined
        ? null
        : sizeOf(variable.scope, initialiser, floors, seen);
    }

    default:
      return null;
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Body text is never set below the smallest size Soft Minimal allows on the surface it is read from (`minBodyFontSize` in packages/ui).",
    },
    schema: [
      {
        type: 'object',
        properties: {
          surface: { type: 'string' },
          minBodyFontSize: { type: 'object', additionalProperties: { type: 'number' } },
        },
        required: ['surface', 'minBodyFontSize'],
        additionalProperties: false,
      },
    ],
    messages: {
      belowFloor:
        'Soft Minimal floors {{surface}} text at {{floor}}px and this is {{size}}px at the design size. Take it from `minBodyFontSize.{{surface}}` in @huddle/ui — a size under the floor is off the handoff\u2019s scale, not merely small.',
    },
  },

  create(context) {
    const [options] = context.options;
    const floors = options.minBodyFontSize;
    const surface = options.surface;
    const floor = floors[surface];

    if (floor === undefined) {
      throw new Error(
        `soft-minimal/body-text-floor: no floor for surface '${surface}' in ${JSON.stringify(floors)}.`,
      );
    }

    const { sourceCode } = context;

    function checkStyleObjects(node) {
      for (const object of objectsIn(node, [])) {
        for (const property of object.properties) {
          if (propertyName(property) !== 'fontSize') {
            continue;
          }

          const size = sizeOf(
            sourceCode.getScope(property),
            property.value,
            floors,
            new Set(),
          );

          if (size !== null && size < floor) {
            context.report({
              node: property,
              messageId: 'belowFloor',
              data: { surface, floor, size },
            });
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
        if (
          node.name.type === 'JSXIdentifier' &&
          node.value !== null &&
          STYLE_PROP.test(node.name.name)
        ) {
          checkStyleObjects(node.value);
        }
      },
    };
  },
};
