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
          return config;
        }

        let content = fs.readFileSync(podfilePath, 'utf8');
        const podLine =
          "  pod 'simdjson', path: '../node_modules/@nozbe/simdjson', modular_headers: true";

        if (!content.includes('@nozbe/simdjson')) {
          if (/(use_expo_modules!\s*\n)/.test(content)) {
            content = content.replace(
              /(use_expo_modules!\s*\n)/,
              `$1${podLine}\n`
            );
          } else if (/(use_react_native!.*\n)/.test(content)) {
            content = content.replace(
              /(use_react_native!.*\n)/,
              `$1${podLine}\n`
            );
          } else if (/(target\s+'[^']+'\s+do\s*\n)/.test(content)) {
            content = content.replace(
              /(target\s+'[^']+'\s+do\s*\n)/,
              `$1${podLine}\n`
            );
          } else {
            content = `${podLine}\n${content}`;
          }

          fs.writeFileSync(podfilePath, content, 'utf8');
        }
      } catch (error) {
        console.warn('[ensure-simdjson] failed to patch Podfile:', error);
      }

      return config;
    },
  ]);
};
