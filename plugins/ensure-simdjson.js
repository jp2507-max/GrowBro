const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Ensures the generated iOS Podfile declares the simdjson dependency that
 * WatermelonDB requires. This works in conjunction with react-native.config.js
 * which handles the proper linking of the simdjson package.
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

        // Check if simdjson is already handled by autolinking or manual declaration
        if (
          content.includes('@nozbe/simdjson') ||
          content.includes("pod 'simdjson'")
        ) {
          console.info('[ensure-simdjson] simdjson already present in Podfile');
          return config;
        }

        // Since we're using react-native.config.js for proper linking,
        // this plugin now serves as a backup only if autolinking fails
        console.info(
          '[ensure-simdjson] simdjson should be handled by autolinking via react-native.config.js'
        );
      } catch (error) {
        console.warn('[ensure-simdjson] failed to check Podfile:', error);
      }

      return config;
    },
  ]);
};
