/**
 * ESLint rule: no-worklet-side-effects
 *
 * Enforces Reanimated worklet best practices by banning side effects and
 * heavy computations inside worklet functions.
 *
 * Requirements: 2.1, 2.2
 */

const BANNED_IDENTIFIERS = new Set([
  'console',
  'fetch',
  'XMLHttpRequest',
  'axios',
  'alert',
  'confirm',
  'prompt',
]);

const CONSOLE_METHODS = new Set([
  'log',
  'warn',
  'error',
  'info',
  'debug',
  'trace',
]);

const NETWORK_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'request',
]);

const AUTO_WORKLET_CALLERS = new Set([
  'useAnimatedStyle',
  'useAnimatedProps',
  'useDerivedValue',
  'useAnimatedScrollHandler',
  'useAnimatedReaction',
  'runOnUI',
  'scheduleOnUI',
]);

const GESTURE_CALLBACKS = new Set([
  'onStart',
  'onUpdate',
  'onEnd',
  'onFinalize',
]);

function isGestureRootCall(node) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression') return false;
  return (
    callee.object &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Gesture'
  );
}

function isGestureBuilderChain(node) {
  let current = node;
  while (current) {
    if (current.type === 'CallExpression') {
      if (isGestureRootCall(current)) return true;
      const callee = current.callee;
      if (callee && callee.type === 'MemberExpression') {
        current = callee.object;
        continue;
      }
    }
    if (current.type === 'MemberExpression') {
      current = current.object;
      continue;
    }
    if (current.type === 'Identifier' && current.name === 'Gesture') {
      return true;
    }
    return false;
  }
  return false;
}

function isGestureCallbackCallExpression(node) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression') return false;
  const propertyName =
    callee.property && callee.property.type === 'Identifier'
      ? callee.property.name
      : null;
  if (!propertyName || !GESTURE_CALLBACKS.has(propertyName)) return false;
  return isGestureBuilderChain(callee.object);
}

/**
 * Check if a node is inside a worklet function
 * Worklets are functions that run on the UI thread in React Native Reanimated
 */
function isInsideWorklet(node) {
  let current = node;

  // Walk up the AST from the given node to find worklet boundaries
  while (current) {
    // Check for explicit worklet functions (marked with 'worklet' directive)
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    ) {
      // Check if function body starts with 'worklet' string literal directive
      if (current.body && current.body.type === 'BlockStatement') {
        const firstStatement = current.body.body[0];
        if (
          firstStatement &&
          firstStatement.type === 'ExpressionStatement' &&
          firstStatement.expression.type === 'Literal' &&
          firstStatement.expression.value === 'worklet'
        ) {
          return true; // Found explicit worklet function
        }
      }

      // Check for auto-workletized functions (Reanimated hooks that run callbacks on UI thread)
      // Check if the function's immediate parent is a CallExpression with a Reanimated hook
      if (current.parent && current.parent.type === 'CallExpression') {
        const callee = current.parent.callee;
        if (
          callee &&
          callee.type === 'Identifier' &&
          AUTO_WORKLET_CALLERS.has(callee.name)
        ) {
          return true; // Found auto-workletized function
        }
        if (isGestureCallbackCallExpression(current.parent)) {
          return true; // RNGH gesture callback
        }
      }
    }
    current = current.parent; // Move up the AST tree
  }
  return false; // Not inside a worklet
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow side effects and heavy computations in Reanimated worklets',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      bannedIdentifier:
        'Worklet contains banned identifier "{{name}}". Worklets must be pure and side-effect free. Use scheduleOnRN to schedule side effects on the JS thread.',
      networkCall:
        'Network calls are not allowed in worklets. Use scheduleOnRN to schedule network requests on the JS thread.',
      consoleLog:
        'console.log is not allowed in worklets. Remove logging or use scheduleOnRN for debugging.',
    },
    schema: [],
  },

  create(context) {
    return {
      // Check for console.log, console.warn, etc.
      MemberExpression(node) {
        if (!isInsideWorklet(node)) {
          return;
        }

        const objectName =
          node.object.type === 'Identifier' ? node.object.name : null;
        const propertyName =
          node.property.type === 'Identifier' ? node.property.name : null;

        // Check for banned identifiers (console, fetch, etc.)
        if (objectName && BANNED_IDENTIFIERS.has(objectName)) {
          if (
            objectName === 'console' &&
            propertyName &&
            CONSOLE_METHODS.has(propertyName)
          ) {
            context.report({
              node,
              messageId: 'consoleLog',
            });
          } else if (
            (objectName === 'fetch' || objectName === 'axios') &&
            propertyName &&
            NETWORK_METHODS.has(propertyName)
          ) {
            context.report({
              node,
              messageId: 'networkCall',
            });
          } else {
            context.report({
              node,
              messageId: 'bannedIdentifier',
              data: { name: objectName },
            });
          }
        }
      },

      // Check for direct fetch() calls
      CallExpression(node) {
        if (!isInsideWorklet(node)) {
          return;
        }

        const calleeName =
          node.callee.type === 'Identifier' ? node.callee.name : null;

        if (calleeName && BANNED_IDENTIFIERS.has(calleeName)) {
          if (calleeName === 'fetch') {
            context.report({
              node,
              messageId: 'networkCall',
            });
          } else {
            context.report({
              node,
              messageId: 'bannedIdentifier',
              data: { name: calleeName },
            });
          }
        }
      },
    };
  },
};
