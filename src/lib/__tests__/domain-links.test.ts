import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../..');
const WELL_KNOWN_DIR = join(ROOT, 'docs', '.well-known');

type AppleAppSiteAssociation = {
  applinks: {
    apps: string[];
    details: { appID: string; paths: string[] }[];
  };
};

type AssetLinksEntry = {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

function loadJSON<T>(relativePath: string): T {
  const payload = readFileSync(join(WELL_KNOWN_DIR, relativePath), 'utf-8');
  return JSON.parse(payload) as T;
}

describe('universal link configuration', () => {
  test('apple-app-site-association lists required bundles', () => {
    const aasa = loadJSON<AppleAppSiteAssociation>(
      'apple-app-site-association'
    );

    expect(Array.isArray(aasa.applinks.apps)).toBe(true);
    expect(aasa.applinks.details.length).toBeGreaterThanOrEqual(1);

    const requiredPaths = [
      '/post/*',
      '/profile/*',
      '/grow/*',
      '/task/*',
      '/feed',
      '/calendar',
    ];

    for (const detail of aasa.applinks.details) {
      expect(detail.appID).toMatch(/^[A-Z0-9]{10}\.com\.growbro(\.[a-z]+)?$/);
      for (const path of requiredPaths) {
        expect(detail.paths).toContain(path);
      }
    }
  });

  test('assetlinks.json exposes Android association for each build target', () => {
    const assetLinks = loadJSON<AssetLinksEntry[]>('assetlinks.json');

    expect(assetLinks.length).toBeGreaterThanOrEqual(1);

    for (const entry of assetLinks) {
      expect(entry.relation).toContain(
        'delegate_permission/common.handle_all_urls'
      );
      expect(entry.target.namespace).toBe('android_app');
      expect(entry.target.package_name).toMatch(
        /^com\.growbro(\.(staging|development))?$/
      );
      expect(entry.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
      for (const fingerprint of entry.target.sha256_cert_fingerprints) {
        expect(typeof fingerprint).toBe('string');
        expect(fingerprint.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('web fallback page', () => {
  test('renders smart banner metadata and store fallback script', () => {
    const html = readFileSync(
      join(ROOT, 'docs', 'web-fallback', 'index.html'),
      'utf-8'
    );
    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('name="apple-itunes-app"');
    expect(html).toContain('name="google-play-app"');
    expect(html).toContain('function openStore');
    expect(html).toContain('setTimeout(function () {');
  });
});
