'use strict';

/**
 * `huddle/tv-remote-surface` — nothing on a TV screen is reachable with the
 * remote, and the app listens for exactly one thing it is pressed for.
 *
 * The principle is the scope's own — "The TV is not the primary controller"
 * (`docs/project-scope.md`) — read the strict way: the television is the stage
 * and the phones are the controllers, so it is not a controller at all. A
 * television that has to be *driven* is a television somebody is looking down
 * at a remote to operate. This rule is where that becomes a number, zero, with
 * no exception; the scope states the principle and nothing else states the
 * number, so do not go looking for a criterion elsewhere to cite.
 *
 * ## Why this is a lint rule and not a code review
 *
 * Focus on a TV is not opt-in. Under `react-native-tvos` a `Pressable`, any
 * `Touchable*`, a `TextInput` or a plain `View` carrying `focusable` becomes a
 * focus target the moment it renders — nobody has to ask for it, and nothing
 * about the diff that adds one *looks* like it is adding a remote surface. So
 * the guard has to be the thing that fails when somebody adds a control, in the
 * spirit of the two Boardwalk rules beside it: a syntactic question, answered by
 * a parser, reported on the line.
 *
 * It is deliberately a rule about *names* rather than about provenance. Its
 * siblings prove that a value came from `@huddle/ui` before allowing it, because
 * a value's origin is the whole question there. Here the question is what the
 * television draws, a `<Pressable>` of somebody's own making is exactly as
 * focusable as React Native's, and the direction a gate should fail in is
 * obvious: the name on the line is what a reviewer reads too.
 *
 * ## Which files stand on the TV
 *
 * Not the rule's question — the flat config's, exactly as with
 * `boardwalk/body-text-floor`: `apps/tv` and a game module's `tv-*` screens. A
 * Controller screen is a screen made entirely of controls, and this rule must
 * never reach one.
 *
 * ## The key listener, and the exception that used to be here
 *
 * Focus is not the only way to reach a television: an app can listen for the
 * remote's key events at the root (`useTVEventHandler`) and answer a press
 * nothing on screen is focused for. So the listener is the second thing this
 * rule governs, and it governs it on every TV file — a listener anywhere would
 * make "nothing here answers the remote" false in a way no reviewer could see.
 *
 * There used to be one exemption, named by the config: `tv-about.tsx`, which
 * summoned the About Panel on a play/pause press. The approved Soft Minimal
 * design draws no About Panel, so the file is gone and the rule now takes no
 * options. Re-introducing an exemption is a repo decision, and it should look
 * like one — a config option coming back, not a filename appearing in here.
 *
 * ## What it does not catch
 *
 * **A TV component factored out of `tv-screen.tsx` into a sibling that is not
 * named `tv-*`.** This is the likeliest gap by some distance: a game author
 * splitting a scoreboard into `packages/games/trivia/src/score-board.tsx` gets
 * no gate on it, because the config's glob keys on the file name. The glob is
 * `boardwalk/body-text-floor`'s, deliberately — "the TV surface" should be one
 * answer rather than two that drift — so widening it is a decision about both
 * rules, and neither is worth widening until a module actually splits a screen.
 * Nothing in the repo does today.
 *
 * A focusable view arriving from another package — a shared component that
 * turns out to render a `Pressable` — is invisible to a rule that reads one file
 * at a time. `@huddle/ui/native` holds one component and it is a `View`; the
 * check that would catch a change there is this rule being switched on for
 * `packages/ui` too, which it is not, because that package is imported by the
 * phone as well and a control is the phone's whole job. What guards it instead
 * is that the TV app has exactly one screen tree, walked in the first block of
 * this rule's test.
 */

/**
 * React Native components that are focus targets on a television.
 *
 * The scrolling four are here for a reason worth stating, since none of them is
 * a "control": the Stage is a fixed 1280×720 surface that never scrolls, so a
 * scroll view on it is either a mistake or a decision to hand the remote
 * something to drive — and on tvOS a scroll view is driven by the remote.
 */
const FOCUSABLE_COMPONENTS = new Set([
  'Button',
  'Pressable',
  'TouchableHighlight',
  'TouchableNativeFeedback',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'TextInput',
  'Switch',
  'TVFocusGuideView',
  'FlatList',
  'ScrollView',
  'SectionList',
  'VirtualizedList',
]);

/**
 * Props that make an ordinary view reachable, or that only exist because
 * something already is.
 *
 * `onFocus`/`onBlur` are in the list not because they create focus but because
 * they are what a screen writes when it has started thinking about it, and a
 * handler for an event that can never fire is worth failing on either way.
 */
const FOCUS_PROPS = new Set([
  'focusable',
  'tvFocusable',
  'isTVSelectable',
  'hasTVPreferredFocus',
  'nextFocusDown',
  'nextFocusForward',
  'nextFocusLeft',
  'nextFocusRight',
  'nextFocusUp',
  'onBlur',
  'onFocus',
  'onLongPress',
  'onPress',
  'onPressIn',
  'onPressOut',
  'tvParallaxProperties',
]);

/**
 * The two names `react-native` hands the remote's key events out under.
 *
 * Judged wherever they are *written* rather than only where they are imported,
 * because importing is not the only way to reach one: `react-native-tvos` types
 * `useTVEventHandler` onto a module pnpm puts out of this app's reach, so the
 * About Panel used to read it off the namespace instead — and a gate that only
 * watched import specifiers would have been walked straight past by the very
 * code it existed to permit. The panel is gone; that route is not.
 */
const REMOTE_LISTENERS = new Set(['TVEventHandler', 'useTVEventHandler']);

/**
 * The name an element is drawn with — the last one, so that
 * `Animated.ScrollView` is judged as the scroll view it is.
 */
function elementName(name) {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXMemberExpression':
      return elementName(name.property);
    default:
      return null;
  }
}

/**
 * Whether a prop is switched off outright, which is the opposite of adding a
 * control: `focusable={false}` is occasionally the fix on Android TV.
 */
function isSwitchedOff(attribute) {
  const { value } = attribute;

  return (
    value !== null &&
    value.type === 'JSXExpressionContainer' &&
    value.expression.type === 'Literal' &&
    value.expression.value === false
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A TV screen holds nothing a remote can focus, and nothing on the television listens for the remote at all (docs/project-scope.md: the TV is not the primary controller).',
    },
    schema: [],
    messages: {
      focusableComponent:
        '`{{name}}` is a focus target on a television, and the TV app requires zero remote interaction — nothing on a TV screen is remote-reachable. Draw this with `View`/`Text` and drive it from the Controller.',
      focusProp:
        '`{{name}}` makes this reachable with the remote, and the TV app requires zero remote interaction — nothing on a TV screen is remote-reachable. Drive it from the Controller instead.',
      remoteListener:
        '`{{name}}` is the remote, and no file on the television may hold it — the television is phone-driven, all of it. Put the behaviour on the Controller.',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = elementName(node.name);

        if (name !== null && FOCUSABLE_COMPONENTS.has(name)) {
          context.report({ node: node.name, messageId: 'focusableComponent', data: { name } });
        }
      },

      JSXAttribute(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          FOCUS_PROPS.has(node.name.name) &&
          !isSwitchedOff(node)
        ) {
          context.report({
            node,
            messageId: 'focusProp',
            data: { name: node.name.name },
          });
        }
      },

      Identifier(node) {
        if (!REMOTE_LISTENERS.has(node.name)) {
          return;
        }

        // `import { useTVEventHandler }` is two identifier nodes over the same
        // characters — the imported name and the local one. The imported name
        // is the one reported, so one import is one complaint.
        if (node.parent.type === 'ImportSpecifier' && node === node.parent.local) {
          return;
        }

        context.report({
          node,
          messageId: 'remoteListener',
          data: { name: node.name },
        });
      },
    };
  },
};
