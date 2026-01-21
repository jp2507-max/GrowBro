module.exports = function (api) {
  api.cache(true);

  const reactCompilerTier = Number(process.env.REACT_COMPILER_TIER ?? '1');
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

              // Expo docs: prefer incremental adoption.
              // Start by compiling only a small set of "safe" directories, then expand.
              // Tiered rollout (set `REACT_COMPILER_TIER` to expand coverage):
              // - 1 (default): components + animations/performance helpers
              // - 2: + all `src/lib/`
              // - 3: + all `src/app/` (still excluding layouts below)
              const allowedRoots = [
                '/src/components/',
                '/src/lib/animations/',
                '/src/lib/performance/',
                ...(reactCompilerTier >= 2 ? ['/src/lib/'] : []),
                ...(reactCompilerTier >= 3 ? ['/src/app/'] : []),
              ];

              if (!allowedRoots.some((root) => normalized.includes(root))) {
                return false;
              }

              // Layouts have been a consistent source of runtime hook-order crashes with the compiler enabled.
              if (
                normalized.includes('/src/app/') &&
                normalized.includes('/_layout.')
              ) {
                return false;
              }

              // Exclude files that are currently crashing with the compiler enabled.
              // We can gradually re-enable these once the underlying issue is fixed.
              const excludedSuffixes = [
                '/src/app/(app)/_layout.tsx',
                '/src/app/(app)/strains/_layout.tsx',
                '/src/app/(app)/community.tsx',
                '/src/components/community/post-card.tsx',
                '/src/components/calendar/calendar-list-items.tsx',
                '/src/components/ui/text.tsx',
                '/src/lib/hooks/use-network-status.ts',
                '/src/lib/strains/use-favorites-auto-sync.ts',
              ];

              return !excludedSuffixes.some((suffix) =>
                normalized.endsWith(suffix)
              );
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
