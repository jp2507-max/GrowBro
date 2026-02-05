module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          unstable_transformImportMeta: true,
          // Expo docs: incremental adoption by controlling which files are compiled.
          // https://docs.expo.dev/guides/react-compiler/#incremental-adoption
          'react-compiler': {
            sources: (filename) => {
              if (!filename) return false;
              const normalized = filename.replace(/\\/g, '/');
              if (!normalized.includes('/src/')) return false;
              return true;
            },
          },
        },
      ],
      'nativewind/babel',
    ],
    plugins: [
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
  };
};
