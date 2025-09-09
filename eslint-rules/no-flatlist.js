/**
 * ESLint rule to enforce "no FlatList in prod" by detecting FlatList usage
 * and suggesting FlashList as an alternative for better performance.
 */

const noFlatlistRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow FlatList usage in production code, use FlashList instead',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noFlatListImport:
        'FlatList import detected. Use FlashList from @shopify/flash-list instead for better performance.',
      noFlatListJSX:
        'FlatList JSX usage detected. Replace with FlashList from @shopify/flash-list for better performance.',
    },
  },

  create(context) {
    return {
      // Detect import statements
      ImportDeclaration(node) {
        // Check for FlatList in destructured imports from react-native
        if (node.source.value === 'react-native') {
          const flatListSpecifier = node.specifiers.find(
            (spec) =>
              spec.type === 'ImportSpecifier' &&
              spec.imported.name === 'FlatList'
          );

          if (flatListSpecifier) {
            context.report({
              node: flatListSpecifier,
              messageId: 'noFlatListImport',
            });
          }
        }
      },

      // Detect JSX usage
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'FlatList'
        ) {
          context.report({
            node,
            messageId: 'noFlatListJSX',
          });
        }
      },

      // Detect FlatList in JSX member expressions (e.g., ReactNative.FlatList)
      JSXMemberExpression(node) {
        if (
          node.property.type === 'JSXIdentifier' &&
          node.property.name === 'FlatList'
        ) {
          context.report({
            node,
            messageId: 'noFlatListJSX',
          });
        }
      },
    };
  },
};

export default {
  rules: {
    'no-flatlist': noFlatlistRule,
  },
};
