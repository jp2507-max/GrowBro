module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@env': './src/lib/env.js',
          },
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
        },
      ],
      'react-native-worklets/plugin',
    ],
    overrides: [
      {
        // Ensure TS is transformed for TS sources shipped in Expo modules
        test: /node_modules[\\/\/]expo-file-system[\\/\/].*\.ts$/,
        plugins: [
          ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ],
      },
      {
        // Ensure JSX in expo-router build output is transformed
        test: /node_modules[\\/\/]expo-router[\\/\/]build[\\/\/].*\.js$/,
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
        ],
      },
    ],
  };
};
