const { withInfoPlist } = require('@expo/config-plugins');

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeHash(hash) {
  if (!hash) return '';
  return hash.replace(/^sha256\//i, '').trim();
}

module.exports = function withSecurityPinning(config, options = {}) {
  return withInfoPlist(config, (config) => {
    const domains = normalizeList(options.domains);
    const hashes = normalizeList(options.hashes).map(sanitizeHash);

    if (!domains.length || !hashes.length) {
      // Remove pinned domains if previously set
      if (config.modResults.NSAppTransportSecurity) {
        delete config.modResults.NSAppTransportSecurity.NSPinnedDomains;
      }
      return config;
    }

    const pinnedLeafIdentities = hashes.map((hash) => ({
      'SPKI-SHA256-BASE64': hash,
    }));

    const pinnedDomains = {};
    domains.forEach((domain) => {
      const allowSubdomains = domain.startsWith('.');
      const normalized = allowSubdomains ? domain.slice(1) : domain;
      pinnedDomains[normalized] = {
        NSIncludesSubdomains: allowSubdomains,
        NSPinnedLeafIdentities: pinnedLeafIdentities,
      };
    });

    const ats =
      config.modResults.NSAppTransportSecurity ??
      (config.modResults.NSAppTransportSecurity = {});

    ats.NSAllowsArbitraryLoads = false;
    ats.NSPinnedDomains = pinnedDomains;

    return config;
  });
};
