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

const BANNED_METHODS = new Set([
  'log',
  'warn',
  'error',
  'info',
  'debug',
  'trace',
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'request',
]);

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
      // Walk up from current function to find if it's passed to a Reanimated hook
      let checkNode = current;
      while (checkNode && checkNode !== node) {
        if (
          checkNode.type === 'CallExpression' &&
          checkNode.callee.type === 'Identifier' &&
          // These Reanimated hooks automatically workletize their callback functions
          (checkNode.callee.name === 'useAnimatedStyle' ||
            checkNode.callee.name === 'useDerivedValue' ||
            checkNode.callee.name === 'useAnimatedScrollHandler' ||
            checkNode.callee.name === 'useAnimatedReaction' ||
            checkNode.callee.name === 'runOnUI')
        ) {
          return true; // Found auto-workletized function
        }
        checkNode = checkNode.parent;
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
        'Worklet contains banned identifier "{{name}}". Worklets must be pure and side-effect free. Use runOnJS to schedule side effects on the JS thread.',
      bannedMethod:
        'Worklet contains banned method call "{{name}}". Worklets must be pure and side-effect free. Use runOnJS to schedule side effects on the JS thread.',
      networkCall:
        'Network calls are not allowed in worklets. Use runOnJS to schedule network requests on the JS thread.',
      consoleLog:
        'console.log is not allowed in worklets. Remove logging or use runOnJS for debugging.',
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
          if (objectName === 'console' && propertyName) {
            context.report({
              node,
              messageId: 'consoleLog',
            });
          } else if (
            (objectName === 'fetch' || objectName === 'axios') &&
            propertyName
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

        // Check for banned methods
        if (propertyName && BANNED_METHODS.has(propertyName)) {
          if (objectName && BANNED_IDENTIFIERS.has(objectName)) {
            // Already reported above
            return;
          }
          context.report({
            node,
            messageId: 'bannedMethod',
            data: { name: propertyName },
          });
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
