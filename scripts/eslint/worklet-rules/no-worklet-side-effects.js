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
 */
function isInsideWorklet(node, context) {
  const sourceCode = context.sourceCode || context.getSourceCode();
  let current = node;

  while (current) {
    // Check for arrow functions or function expressions
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    ) {
      // Check if function body contains 'worklet' directive
      if (current.body && current.body.type === 'BlockStatement') {
        const firstStatement = current.body.body[0];
        if (
          firstStatement &&
          firstStatement.type === 'ExpressionStatement' &&
          firstStatement.expression.type === 'Literal' &&
          firstStatement.expression.value === 'worklet'
        ) {
          return true;
        }
      }

      // Check for useAnimatedStyle, useDerivedValue, etc. (auto-workletized)
      const ancestors = sourceCode.getAncestors(node);
      const parent = ancestors.find((ancestor) => {
        return (
          ancestor.type === 'CallExpression' &&
          ancestor.callee.type === 'Identifier' &&
          (ancestor.callee.name === 'useAnimatedStyle' ||
            ancestor.callee.name === 'useDerivedValue' ||
            ancestor.callee.name === 'useAnimatedScrollHandler' ||
            ancestor.callee.name === 'useAnimatedReaction' ||
            ancestor.callee.name === 'runOnUI')
        );
      });

      if (parent) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
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
        if (!isInsideWorklet(node, context)) {
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
        if (!isInsideWorklet(node, context)) {
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
