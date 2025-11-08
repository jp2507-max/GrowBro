/**
 * Custom ESLint rules for Reanimated worklet validation
 */

const noWorkletSideEffects = require('./no-worklet-side-effects.js');

module.exports = {
  meta: {
    name: 'eslint-plugin-worklet-rules',
  },
  rules: {
    'no-worklet-side-effects': noWorkletSideEffects,
  },
  configs: {
    recommended: {
      plugins: ['worklet-rules'],
      rules: {
        'worklet-rules/no-worklet-side-effects': 'error',
      },
    },
  },
};
