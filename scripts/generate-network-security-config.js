#!/usr/bin/env node
/**
 * Generates Android network_security_config.xml with optional certificate pinning.
 * Reads SECURITY_PIN_DOMAINS / SECURITY_PIN_HASHES from env (comma-separated).
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.join(__dirname, '..');
const appEnv = process.env.APP_ENV ?? 'development';

const envFile = path.join(repoRoot, `.env.${appEnv}`);
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}
const localEnvFile = path.join(repoRoot, '.env.local');
if (fs.existsSync(localEnvFile)) {
  dotenv.config({ path: localEnvFile, override: true });
}

const domainsRaw =
  process.env.SECURITY_PIN_DOMAINS ||
  process.env.EXPO_PUBLIC_SECURITY_PIN_DOMAINS ||
  '';
const hashesRaw =
  process.env.SECURITY_PIN_HASHES ||
  process.env.EXPO_PUBLIC_SECURITY_PIN_HASHES ||
  '';

const parseList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const domains = parseList(domainsRaw);
const hashes = parseList(hashesRaw);

const xmlDir = path.join(
  repoRoot,
  'android',
  'app',
  'src',
  'main',
  'res',
  'xml'
);
fs.mkdirSync(xmlDir, { recursive: true });
const targetPath = path.join(xmlDir, 'network_security_config.xml');

const getCertificatePinExpiration = () => {
  const envExpiration =
    process.env.CERT_PIN_EXPIRATION ||
    process.env.EXPO_PUBLIC_CERT_PIN_EXPIRATION;

  if (envExpiration) {
    const envDate = new Date(envExpiration);
    // Validate that the date is valid and in the future
    if (!isNaN(envDate.getTime()) && envDate > new Date()) {
      return envDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }
  }

  // Fallback: current year + 2 years
  const fallbackDate = new Date();
  fallbackDate.setFullYear(fallbackDate.getFullYear() + 2);
  return fallbackDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
};

const buildPinSet = () => {
  if (!hashes.length) {
    return '';
  }
  const pins = hashes
    .map((hash) => `      <pin digest="SHA-256">${hash}</pin>`)
    .join('\n');
  const expirationDate = getCertificatePinExpiration();
  return [
    `    <pin-set expiration="${expirationDate}">`,
    pins,
    '    </pin-set>',
  ].join('\n');
};

let xml;
if (domains.length && hashes.length) {
  const domainBlocks = domains
    .map((domain) => {
      return [
        '  <domain-config cleartextTrafficPermitted="false">',
        `    <domain includeSubdomains="true">${domain}</domain>`,
        buildPinSet(),
        '  </domain-config>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
${domainBlocks}
</network-security-config>
`;
  console.log(
    `[security] Generated Android pinning config for domains: ${domains.join(
      ', '
    )}`
  );
} else {
  xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!--
    No SECURITY_PIN_DOMAINS / SECURITY_PIN_HASHES configured.
    Android will enforce HTTPS but certificate pinning is disabled.
    Provide comma-separated lists in your .env files before production builds.
  -->
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
`;
  console.warn(
    '[security] SECURITY_PIN_DOMAINS / SECURITY_PIN_HASHES not configured. Pinning disabled.'
  );
}

fs.writeFileSync(targetPath, xml, 'utf8');
