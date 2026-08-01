'use strict';

/**
 * The parts of "find every style object this file writes" that Boardwalk's two
 * lint rules both need.
 *
 * `boardwalk/tokens-only` asks where a value was *written*; `boardwalk/body-text-floor`
 * asks what a value *is*. Different questions, but both of them have to reach
 * the same places first — the object passed to `StyleSheet.create`, and
 * anything inside a `style`/`…Style` JSX prop — and neither has any business
 * re-deriving that walk. What is shared here is only the walk and the scope
 * lookup under it: each rule keeps its own judgement, which is the whole of
 * what makes it that rule.
 */

/** The theme package, and the only import a design value may come from. */
const THEME = /^@huddle\/ui(?:\/|$)/;

/** Style props: `style`, `wrapperStyle`, `contentContainerStyle`, … */
const STYLE_PROP = /^(?:style|[a-zA-Z]+Style)$/;

/** Unwraps the TypeScript and grouping nodes that sit between a value and its expression. */
function unwrap(node) {
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSInstantiationExpression':
    case 'ChainExpression':
      return unwrap(node.expression);
    default:
      return node;
  }
}

/** Every object expression reachable through a style prop or a style sheet. */
function objectsIn(node, found) {
  if (node === null || node === undefined || typeof node.type !== 'string') {
    return found;
  }

  const value = unwrap(node);

  switch (value.type) {
    case 'ObjectExpression':
      found.push(value);
      for (const property of value.properties) {
        objectsIn(property.type === 'SpreadElement' ? property.argument : property.value, found);
      }
      break;
    case 'ArrayExpression':
      for (const element of value.elements) {
        objectsIn(element, found);
      }
      break;
    case 'SpreadElement':
      objectsIn(value.argument, found);
      break;
    case 'ConditionalExpression':
      objectsIn(value.consequent, found);
      objectsIn(value.alternate, found);
      break;
    case 'LogicalExpression':
      objectsIn(value.left, found);
      objectsIn(value.right, found);
      break;
    case 'JSXExpressionContainer':
      objectsIn(value.expression, found);
      break;
    default:
      break;
  }

  return found;
}

/** A property's name, or `null` where there is no name to read off the source. */
function propertyName(property) {
  if (property.type !== 'Property' || property.computed) {
    return null;
  }
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  return property.key.type === 'Literal' ? String(property.key.value) : null;
}

function isStyleSheetCreate(node) {
  const { callee } = node;

  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'StyleSheet' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'create'
  );
}

/** The variable a name resolves to, looking outward from `scope`. */
function lookUp(scope, name) {
  for (let current = scope; current !== null; current = current.upper) {
    const variable = current.variables.find((candidate) => candidate.name === name);

    if (variable !== undefined) {
      return variable;
    }
  }

  return null;
}

module.exports = {
  THEME,
  STYLE_PROP,
  unwrap,
  objectsIn,
  propertyName,
  isStyleSheetCreate,
  lookUp,
};
