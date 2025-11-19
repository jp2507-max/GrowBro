/* eslint-env node */
/**
 * Expo config plugin to ensure CocoaPods CDN source is properly configured.
 * Fixes: "Unable to add a source with url `https://cdn.cocoapods.org/`" error
 * during EAS builds.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 */
function withPodfileSource(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withPodfileSource] Podfile not found, skipping...');
        return cfg;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if source is already defined
      const hasSource =
        /^\s*source\s+['"]https:\/\/cdn\.cocoapods\.org\/?['"]/m.test(
          podfileContent
        );

      if (!hasSource) {
        // Add source at the top of the Podfile (after require statements)
        const sourceDeclaration = "source 'https://cdn.cocoapods.org/'\n";

        // Find the position after require statements or at the beginning
        const requireMatch = podfileContent.match(/^require.*$/m);
        if (requireMatch) {
          const insertPos =
            podfileContent.indexOf(requireMatch[0]) + requireMatch[0].length;
          podfileContent =
            podfileContent.slice(0, insertPos) +
            '\n\n' +
            sourceDeclaration +
            podfileContent.slice(insertPos);
        } else {
          // No require statements, add at the very top
          podfileContent = sourceDeclaration + '\n' + podfileContent;
        }

        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log(
          '[withPodfileSource] Added CocoaPods CDN source to Podfile'
        );
      } else {
        console.log(
          '[withPodfileSource] CocoaPods CDN source already configured'
        );
      }

      return cfg;
    },
  ]);
}

module.exports = withPodfileSource;
