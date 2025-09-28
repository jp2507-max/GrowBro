const path = require('node:path');

const {
  getColorTokenSuggestions,
  getSpacingTokenSuggestions,
  spacingScale,
  normalizeHex,
} = require(path.resolve(__dirname, '../../design-tokens/token-metadata'));

const COLOR_PROPERTIES = new Set([
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'shadowColor',
  'textDecorationColor',
  'tintColor',
]);

const SPACING_PROPERTIES = new Set([
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingHorizontal',
  'paddingVertical',
  'gap',
  'rowGap',
  'columnGap',
  'top',
  'bottom',
  'left',
  'right',
]);

const COLOR_MESSAGE_ID = 'colorLiteral';
const COLOR_GENERIC_MESSAGE_ID = 'colorLiteralGeneric';
const SPACING_MESSAGE_ID = 'spacingLiteral';
const SPACING_GENERIC_MESSAGE_ID = 'spacingLiteralGeneric';

function getPropertyName(property) {
  if (property.computed) {
    return null;
  }

  if (property.key.type === 'Identifier') {
    return property.key.name;
  }

  if (
    property.key.type === 'Literal' &&
    typeof property.key.value === 'string'
  ) {
    return property.key.value;
  }

  return null;
}

function parseNumericString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('px')) {
    const parsed = Number.parseFloat(trimmed.replace('px', ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatColorSuggestion(tokens) {
  if (!tokens.length) {
    return '';
  }

  const formatted = tokens
    .map((token) => {
      const segments = token.split('-');
      if (segments.length === 1) {
        return `colors.${segments[0]}`;
      }

      const [root, ...rest] = segments;
      const pathSegments = rest
        .map((segment) =>
          Number.isNaN(Number(segment)) ? `.${segment}` : `[${segment}]`
        )
        .join('');
      return `colors.${root}${pathSegments}`;
    })
    .join(', ');

  return formatted;
}

function formatSpacingSuggestion(tokens, numericValue) {
  if (!tokens.length) {
    return '';
  }

  const lookup = new Map(
    spacingScale.map((entry) => [entry.token, entry.value])
  );

  return tokens
    .map((token) => {
      const value = lookup.get(token);
      const resolved = value ?? numericValue;
      return `${token} (${resolved})`;
    })
    .join(', ');
}

function shouldSkipColor(value) {
  const trimmed = value.trim().toLowerCase();
  const allowedKeywords = new Set([
    'transparent',
    'currentcolor',
    'inherit',
    'auto',
    'none',
  ]);

  if (allowedKeywords.has(trimmed)) {
    return true;
  }

  return (
    trimmed.startsWith('rgba(') ||
    trimmed.startsWith('rgb(') ||
    trimmed.startsWith('hsl(') ||
    trimmed.startsWith('hsla(')
  );
}

function reportColorViolation(context, details) {
  const { node, propertyName, literalValue } = details;
  if (shouldSkipColor(literalValue)) {
    return;
  }

  const suggestions = getColorTokenSuggestions(literalValue);
  if (suggestions.length) {
    context.report({
      node,
      messageId: COLOR_MESSAGE_ID,
      data: {
        propertyName,
        value: normalizeHex(literalValue) ?? literalValue,
        suggestion: formatColorSuggestion(suggestions),
      },
    });
    return;
  }

  context.report({
    node,
    messageId: COLOR_GENERIC_MESSAGE_ID,
    data: {
      propertyName,
      value: literalValue,
    },
  });
}

function reportSpacingViolation(context, details) {
  const { node, propertyName, numericValue } = details;
  if (numericValue === 0) {
    return;
  }

  const suggestions = getSpacingTokenSuggestions(numericValue);
  if (suggestions.length) {
    context.report({
      node,
      messageId: SPACING_MESSAGE_ID,
      data: {
        propertyName,
        value: numericValue,
        suggestion: formatSpacingSuggestion(suggestions, numericValue),
      },
    });
    return;
  }

  context.report({
    node,
    messageId: SPACING_GENERIC_MESSAGE_ID,
    data: {
      propertyName,
      value: numericValue,
    },
  });
}

function inspectStyleObject(context, objectExpression) {
  for (const property of objectExpression.properties) {
    if (property.type !== 'Property') {
      continue;
    }

    const propertyName = getPropertyName(property);
    if (!propertyName) {
      continue;
    }

    if (COLOR_PROPERTIES.has(propertyName)) {
      const valueNode = property.value;
      if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') {
        reportColorViolation(context, {
          node: valueNode,
          propertyName,
          literalValue: valueNode.value,
        });
      }
    }

    if (SPACING_PROPERTIES.has(propertyName)) {
      const valueNode = property.value;

      if (valueNode.type === 'Literal' && typeof valueNode.value === 'number') {
        reportSpacingViolation(context, {
          node: valueNode,
          propertyName,
          numericValue: valueNode.value,
        });
        continue;
      }

      if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') {
        const parsed = parseNumericString(valueNode.value);
        if (parsed !== null) {
          reportSpacingViolation(context, {
            node: valueNode,
            propertyName,
            numericValue: parsed,
          });
        }
      }

      if (
        valueNode.type === 'UnaryExpression' &&
        valueNode.operator === '-' &&
        valueNode.argument.type === 'Literal'
      ) {
        const argumentValue = valueNode.argument.value;
        if (typeof argumentValue === 'number') {
          reportSpacingViolation(context, {
            node: valueNode,
            propertyName,
            numericValue: -argumentValue,
          });
        }
      }
    }
  }
}

function isStyleSheetCreate(node) {
  if (node.callee.type !== 'MemberExpression') {
    return false;
  }

  const { object, property } = node.callee;
  return (
    !node.callee.computed &&
    object.type === 'Identifier' &&
    object.name === 'StyleSheet' &&
    property.type === 'Identifier' &&
    property.name === 'create'
  );
}

function inspectJSXStyleAttribute(context, attribute) {
  if (attribute.name.name !== 'style' || !attribute.value) {
    return;
  }

  if (attribute.value.type !== 'JSXExpressionContainer') {
    return;
  }

  const { expression } = attribute.value;

  if (expression.type === 'ObjectExpression') {
    inspectStyleObject(context, expression);
    return;
  }

  if (expression.type === 'ArrayExpression') {
    for (const element of expression.elements) {
      if (element && element.type === 'ObjectExpression') {
        inspectStyleObject(context, element);
      }
    }
  }
}

const rules = {
  'enforce-design-tokens': {
    meta: {
      type: 'suggestion',
      docs: {
        description:
          'Enforce design token usage for colors and spacing in inline styles and StyleSheet definitions.',
      },
      schema: [],
      messages: {
        [COLOR_MESSAGE_ID]:
          "Avoid hard-coded color '{{value}}' for '{{propertyName}}'. Use design token(s): {{suggestion}}.",
        [COLOR_GENERIC_MESSAGE_ID]:
          "Avoid hard-coded color '{{value}}' for '{{propertyName}}'. Replace with a design token from src/components/ui/colors.js.",
        [SPACING_MESSAGE_ID]:
          "Avoid hard-coded spacing value {{value}} for '{{propertyName}}'. Use spacing token(s): {{suggestion}}.",
        [SPACING_GENERIC_MESSAGE_ID]:
          "Avoid hard-coded spacing value {{value}} for '{{propertyName}}'. Replace with a Tailwind spacing token.",
      },
    },
    create(context) {
      return {
        CallExpression(node) {
          if (!isStyleSheetCreate(node)) {
            return;
          }

          for (const argument of node.arguments) {
            if (argument && argument.type === 'ObjectExpression') {
              inspectStyleObject(context, argument);
            }
          }
        },
        JSXAttribute(node) {
          inspectJSXStyleAttribute(context, node);
        },
      };
    },
  },
};

module.exports = {
  meta: {
    name: 'eslint-plugin-growbro-design-tokens',
  },
  rules,
  configs: {
    recommended: {
      plugins: ['growbro-design-tokens'],
      rules: {
        'growbro-design-tokens/enforce-design-tokens': 'error',
      },
    },
  },
};
