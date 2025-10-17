import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import i18nJsonPlugin from 'eslint-plugin-i18n-json';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactCompiler from 'eslint-plugin-react-compiler';
import reactNative from 'eslint-plugin-react-native';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tailwind from 'eslint-plugin-tailwindcss';
import testingLibrary from 'eslint-plugin-testing-library';
// eslint-disable-next-line import/no-named-as-default, import/no-named-as-default-member, import/namespace
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import { configs, parser, plugin } from 'typescript-eslint';

import growbroDesignTokens from './scripts/eslint/design-tokens/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  globalIgnores([
    'dist/*',
    'package/dist',
    'node_modules',
    '__tests__/',
    'coverage',
    '.expo',
    '.expo-shared',
    'android',
    'ios',
    '.vscode',
    'docs/',
    'cli/',
    'expo-env.d.ts',
    // Ignore vendored workspace to avoid Prettier plugin resolution from its config
    'react-native-reanimated/',
    // Ignore built outputs
    'package/dist/',
    // Ignore Deno test files in Supabase functions
    'supabase/functions/**/*.test.ts',
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  ...tailwind.configs['flat/recommended'],
  reactCompiler.configs.recommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      unicorn: eslintPluginUnicorn,
      'unused-imports': unusedImports,
      'react-native': reactNative,
      'react-native-a11y': reactNativeA11y,
      'growbro-design-tokens': growbroDesignTokens,
    },
    rules: {
      'max-params': ['error', 3],
      'max-lines-per-function': ['warn', 110],
      'tailwindcss/classnames-order': [
        'warn',
        {
          officialSorting: true,
        },
      ],
      'tailwindcss/no-custom-classname': 'off',
      'react/display-name': 'off',
      'react/destructuring-assignment': 'off',
      'react/require-default-props': 'off',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: ['/android', '/ios'],
        },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'import/prefer-default-export': 'off',
      'import/no-cycle': ['error', { maxDepth: Infinity }],
      'prettier/prettier': ['error'],
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'off',
      'react-native-a11y/has-accessibility-hint': 'warn',
      'react-native-a11y/has-accessibility-props': 'error',
      'react-native-a11y/has-valid-accessibility-actions': 'error',
      'react-native-a11y/has-valid-accessibility-component-type': 'error',
      'react-native-a11y/has-valid-accessibility-descriptors': 'error',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
      'react-native-a11y/has-valid-accessibility-states': 'error',
      'react-native-a11y/has-valid-accessibility-traits': 'error',
      'react-native-a11y/has-valid-accessibility-value': 'error',
      'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 'warn',
      'react-native-a11y/has-valid-accessibility-live-region': 'error',
      'react-native-a11y/has-valid-important-for-accessibility': 'warn',
      'react-native-a11y/no-nested-touchables': 'error',
      'growbro-design-tokens/enforce-design-tokens': 'warn',
      // (removed custom no-flatlist rule)
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
    },
    rules: {
      ...configs.recommended.rules,
      '@typescript-eslint/comma-dangle': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
    },
  },
  // Loosen typed linting for mocks to avoid requiring TS project inclusion
  {
    files: ['__mocks__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        project: undefined,
        sourceType: 'module',
      },
    },
  },
  {
    files: ['src/translations/*.json'],
    plugins: { 'i18n-json': i18nJsonPlugin },
    processor: {
      meta: { name: '.json' },
      ...i18nJsonPlugin.processors['.json'],
    },
    rules: {
      ...i18nJsonPlugin.configs.recommended.rules,
      'i18n-json/valid-message-syntax': [
        2,
        {
          syntax: path.resolve(
            __dirname,
            './scripts/i18next-syntax-validation.js'
          ),
        },
      ],
      'i18n-json/valid-json': 2,
      'i18n-json/sorted-keys': [
        2,
        {
          order: 'asc',
          indentSpaces: 2,
        },
      ],
      'i18n-json/identical-keys': [
        2,
        {
          filePath: path.resolve(__dirname, './src/translations/en.json'),
        },
      ],
      'prettier/prettier': [
        0,
        {
          singleQuote: true,
          endOfLine: 'auto',
        },
      ],
    },
  },
  // JSX-heavy components (screens, complex layouts) - more lenient
  {
    files: [
      'src/app/**/*.tsx',
      'src/components/**/*-screen.tsx',
      'src/components/**/*-modal.tsx',
      'src/components/**/*-sheet.tsx',
    ],
    rules: {
      'max-lines-per-function': ['warn', 150],
    },
  },
  // Services, hooks, utilities - stricter limits
  {
    files: [
      'src/lib/**/*.{ts,tsx}',
      'src/api/**/*.{ts,tsx}',
      'src/**/use-*.{ts,tsx}',
      'src/**/*.service.{ts,tsx}',
    ],
    rules: {
      'max-lines-per-function': ['error', 90],
    },
  },
  // Test files - exempt from max-lines-per-function and max-params (must come after stricter rules)
  {
    files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    plugins: { 'testing-library': testingLibrary },
    rules: {
      ...testingLibrary.configs.react.rules,
      'max-lines-per-function': 'off',
      'max-params': 'off',
      '@typescript-eslint/no-require-imports': 'off', // Jest dynamic mocking requires require()
    },
  },
  // Deno Edge Functions use jsr:/npm: specifiers that Node import resolver can't resolve
  {
    files: ['supabase/functions/**/*.{ts,tsx}'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  // Scripts and generated packages run in Node; allow __dirname/Buffer and relax length
  {
    files: [
      'scripts/**/*.js',
      'package/dist/**/*.{js,ts}',
      '**/*.stories.{ts,tsx}',
      '**/*.generated.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      'max-lines-per-function': 'off',
    },
  },
]);
