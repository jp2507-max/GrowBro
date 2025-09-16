/* eslint-disable max-lines-per-function */
import { dirname } from './path-utils';

describe('dirname', () => {
  describe('URI handling with authorities', () => {
    test('preserves authority and adds trailing slash for root paths', () => {
      expect(dirname('https://example.com')).toBe('https://example.com/');
    });

    test('preserves authority and trailing slash for root paths that already have it', () => {
      expect(dirname('https://example.com/')).toBe('https://example.com/');
    });

    test('preserves authority for paths with additional segments', () => {
      expect(dirname('https://example.com/a')).toBe('https://example.com');
    });

    test('handles complex authorities with ports', () => {
      expect(dirname('https://example.com:8080')).toBe(
        'https://example.com:8080/'
      );
      expect(dirname('https://example.com:8080/')).toBe(
        'https://example.com:8080/'
      );
      expect(dirname('https://example.com:8080/path')).toBe(
        'https://example.com:8080'
      );
    });

    test('handles different schemes', () => {
      expect(dirname('http://example.com')).toBe('http://example.com/');
      expect(dirname('ftp://example.com')).toBe('ftp://example.com/');
      expect(dirname('file://localhost')).toBe('file://localhost/');
    });
  });

  describe('URI handling with paths', () => {
    test('handles multi-level paths correctly', () => {
      expect(dirname('https://example.com/a/b/c')).toBe(
        'https://example.com/a/b'
      );
      expect(dirname('https://example.com/a/b/')).toBe(
        'https://example.com/a/b'
      );
    });

    test('handles file scheme with authorities', () => {
      expect(dirname('file://server/share/file.txt')).toBe(
        'file://server/share'
      );
      expect(dirname('file://server/share/')).toBe('file://server/share');
    });
  });

  describe('non-URI paths', () => {
    test('handles standard Unix-style paths', () => {
      expect(dirname('/usr/local/bin')).toBe('/usr/local');
      expect(dirname('/usr/local/')).toBe('/usr/local');
      expect(dirname('/')).toBe('/');
      expect(dirname('file.txt')).toBe('.');
    });

    test('handles Windows-style paths normalized to forward slashes', () => {
      expect(dirname('C:/Users/Documents/file.txt')).toBe('C:/Users/Documents');
      expect(dirname('C:/Users/Documents/')).toBe('C:/Users/Documents');
    });
  });

  describe('edge cases', () => {
    test('handles empty and invalid inputs', () => {
      expect(dirname('')).toBe('/');
      expect(dirname('no-scheme')).toBe('.');
    });

    test('handles scheme-only URIs', () => {
      expect(dirname('https:')).toBe('https:/');
      expect(dirname('file:')).toBe('file:/');
    });
  });
});
