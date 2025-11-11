const { RuleTester } = require('eslint');
const rule = require('../no-worklet-side-effects');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run('no-worklet-side-effects', rule, {
  valid: [
    // Console.log outside worklet should be allowed
    {
      code: `
        import { useAnimatedStyle } from 'react-native-reanimated';

        const Component = () => {
          console.log('This is fine - outside worklet');
          const animatedStyle = useAnimatedStyle(() => {
            'worklet';
            return { opacity: 1 };
          });
          return null;
        };
      `,
    },
    // Worklet without side effects should be allowed
    {
      code: `
        import { useAnimatedStyle } from 'react-native-reanimated';

        const Component = () => {
          const animatedStyle = useAnimatedStyle(() => {
            'worklet';
            const value = Math.random();
            return { opacity: value };
          });
          return null;
        };
      `,
    },
    // Explicit worklet function without side effects
    {
      code: `
        function myWorklet() {
          'worklet';
          return { x: 10 };
        }
      `,
    },
  ],

  invalid: [
    // Console.log in useAnimatedStyle worklet should be invalid
    {
      code: `
        import { useAnimatedStyle } from 'react-native-reanimated';

        const Component = () => {
          const animatedStyle = useAnimatedStyle(() => {
            'worklet';
            console.log('This should be flagged');
            return { opacity: 1 };
          });
          return null;
        };
      `,
      errors: [
        {
          messageId: 'consoleLog',
          type: 'MemberExpression',
        },
      ],
    },
    // Console.warn in worklet should be invalid
    {
      code: `
        import { useDerivedValue } from 'react-native-reanimated';

        const Component = () => {
          const derived = useDerivedValue(() => {
            'worklet';
            console.warn('Warning in worklet');
            return 42;
          });
          return null;
        };
      `,
      errors: [
        {
          messageId: 'consoleLog',
          type: 'MemberExpression',
        },
      ],
    },
    // Fetch in worklet should be invalid
    {
      code: `
        import { runOnUI } from 'react-native-reanimated';

        runOnUI(() => {
          'worklet';
          fetch('/api/data');
        })();
      `,
      errors: [
        {
          messageId: 'networkCall',
          type: 'CallExpression',
        },
      ],
    },
    // Alert in worklet should be invalid
    {
      code: `
        function myWorklet() {
          'worklet';
          alert('Hello from worklet');
        }
      `,
      errors: [
        {
          messageId: 'bannedIdentifier',
          data: { name: 'alert' },
          type: 'CallExpression',
        },
      ],
    },
    // Axios call in worklet should be invalid
    {
      code: `
        import { useAnimatedStyle } from 'react-native-reanimated';

        const Component = () => {
          const animatedStyle = useAnimatedStyle(() => {
            'worklet';
            axios.get('/api/data');
            return { opacity: 1 };
          });
          return null;
        };
      `,
      errors: [
        {
          messageId: 'networkCall',
          type: 'MemberExpression',
        },
      ],
    },
  ],
});
