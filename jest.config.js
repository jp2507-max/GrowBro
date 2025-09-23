module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js',
    '!**/docs/**',
    '!**/cli/**',
  ],
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  transformIgnorePatterns: [
    `node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|@sentry/.*|native-base|react-native-svg))`,
  ],
  coverageReporters: ['json-summary', ['text', { file: 'coverage.txt' }]],
  reporters: [
    'default',
    ['github-actions', { silent: false }],
    'summary',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'jest-junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],
  coverageDirectory: '<rootDir>/coverage/',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@env$': '<rootDir>/src/lib/env.js',
    '\\.(css)$': '<rootDir>/__mocks__/style-mock.js',
    '^@gorhom/bottom-sheet(.*)$':
      '<rootDir>/__mocks__/@gorhom/bottom-sheet.tsx',
    '^@nozbe/watermelondb/adapters/sqlite$':
      '<rootDir>/__mocks__/@nozbe/watermelondb/adapters/sqlite',
    '^@nozbe/watermelondb/decorators(.*)$':
      '<rootDir>/__mocks__/@nozbe/watermelondb/decorators$1',
    // Map the entire WatermelonDB package to our lightweight Jest mock to avoid
    // native module initialization that keeps the Jest process open (hanging tests)
    '^@nozbe/watermelondb$': '<rootDir>/__mocks__/@nozbe/watermelondb',
    '^@nozbe/watermelondb/Schema/migrations$':
      '<rootDir>/__mocks__/@nozbe/watermelondb',
    '^react-native-gesture-handler$':
      '<rootDir>/__mocks__/react-native-gesture-handler.ts',
  },
};
