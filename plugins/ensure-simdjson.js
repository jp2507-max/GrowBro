const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Ensures the generated iOS Podfile declares the simdjson dependency that
 * WatermelonDB requires. Expo's managed workflow does not add this pod by
 * default, which causes cloud builds to fail when CocoaPods cannot resolve the
 * spec from the CDN.
 */
module.exports = function ensureSimdjson(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosProjectRoot, 'Podfile');

      try {
        if (!fs.existsSync(podfilePath)) {
          console.info('[ensure-simdjson] Podfile not found at', podfilePath);
          return config;
        }

        let content = fs.readFileSync(podfilePath, 'utf8');
        // Normalize newlines to make regexes simpler
        const nl = content.includes('\r\n') ? '\r\n' : '\n';
        const podLine =
          "  pod 'simdjson', path: '../node_modules/@nozbe/simdjson', modular_headers: true";

        if (
          content.includes('@nozbe/simdjson') ||
          content.includes("pod 'simdjson'")
        ) {
          console.info('[ensure-simdjson] simdjson already present in Podfile');
          return config;
        }

        // Try a sequence of insertion points that match common Podfile styles.
        const patterns = [
          /use_expo_modules!\s*\n/i,
          /use_react_native!\([^\)]*\)\s*\n/i,
          /use_react_native!.*\n/i,
          /target\s+['\"][^'\"]+['\"]\s+do\s*\n/i,
        ];

        let patched = false;
        for (const pat of patterns) {
          if (pat.test(content)) {
            content = content.replace(pat, (m) => `${m}${podLine}${nl}`);
            patched = true;
            console.info(
              '[ensure-simdjson] inserted simdjson after match',
              pat.toString()
            );
            break;
          }
        }

        if (!patched) {
          // Fallback: add at top
          content = `${podLine}${nl}${content}`;
          console.info('[ensure-simdjson] inserted simdjson at top of Podfile');
        }

        fs.writeFileSync(podfilePath, content, 'utf8');
      } catch (error) {
        console.warn('[ensure-simdjson] failed to patch Podfile:', error);
      }

      return config;
    },
  ]);
};
