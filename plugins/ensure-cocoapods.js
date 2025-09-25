const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Expo config plugin that ensures the generated iOS Podfile contains the
 * CocoaPods CDN source and a small `pod repo update` bootstrap so EAS cloud
 * builds can find Podspecs like `simdjson` used by WatermelonDB.
 *
 * This plugin is intentionally conservative:
 * - only edits Podfile if it exists
 * - only injects lines when they are not already present
 */
module.exports = function ensureCocoapods(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosProjectRoot, 'Podfile');

      try {
        if (!fs.existsSync(podfilePath)) return config;

        let content = fs.readFileSync(podfilePath, 'utf8');

        // Ensure CDN source exists
        if (!/source ['"]https:\/\/cdn.cocoapods.org\//.test(content)) {
          content = "source 'https://cdn.cocoapods.org/'\n" + content;
        }

        // Ensure a lightweight pod repo update is run early (idempotent)
        if (!/pod repo update/.test(content)) {
          const updateSnippet = [
            'begin',
            '  # Attempt to update CocoaPods specs so cloud/CI builds can find',
            '  # pods like `simdjson` required by WatermelonDB. Fail silently.',
            "  system('pod repo update')",
            'rescue => e',
            "  puts 'pod repo update failed: ' + e.to_s",
            'end',
            '',
          ].join('\n');

          // Insert after the source line if present, otherwise at top
          if (/^source ['\"]/m.test(content)) {
            content = content.replace(
              /^(source .*)/m,
              '$1\n\n' + updateSnippet
            );
          } else {
            content = updateSnippet + content;
          }
        }

        fs.writeFileSync(podfilePath, content, 'utf8');
      } catch (e) {
        // Don't break prebuild if something goes wrong; log to console so CI shows it.
        console.warn('[ensure-cocoapods] failed to patch Podfile:', e);
      }

      return config;
    },
  ]);
};
