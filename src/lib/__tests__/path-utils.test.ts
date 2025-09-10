import { cleanup } from '@/lib/test-utils';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  joinPath,
  normalizePath,
  resolvePath,
  toPosixPath,
} from '@/lib/utils/path-utils';

afterEach(cleanup);

describe('joinPath URI Scheme Preservation', () => {
  test('preserves file:/// URIs', () => {
    expect(joinPath('file:///', 'foo', 'bar')).toBe('file:///foo/bar');
    expect(joinPath('file:///path', 'to', 'file.txt')).toBe(
      'file:///path/to/file.txt'
    );
    expect(joinPath('file:///')).toBe('file:///');
  });

  test('preserves file:// URIs', () => {
    expect(joinPath('file://', 'server', 'share', 'file.txt')).toBe(
      'file://server/share/file.txt'
    );
    expect(joinPath('file://server')).toBe('file://server');
  });

  test('handles plain paths normally', () => {
    expect(joinPath('/usr', 'local', 'bin')).toBe('/usr/local/bin');
    expect(joinPath('relative', 'path')).toBe('relative/path');
    expect(joinPath('')).toBe('');
  });

  test('handles mixed URI and plain segments', () => {
    expect(joinPath('file:///', '/absolute', 'path')).toBe(
      'file:///absolute/path'
    );
    expect(joinPath('https://', 'example.com', '/api')).toBe(
      'https://example.com/api'
    );
    expect(joinPath('ftp://', 'host', 'path')).toBe('ftp://host/path');
  });

  test('preserves URI schemes with complex paths', () => {
    expect(joinPath('file:///home/user', 'documents', 'file.txt')).toBe(
      'file:///home/user/documents/file.txt'
    );
    expect(joinPath('s3://', 'bucket', 'path', 'to', 'file')).toBe(
      's3://bucket/path/to/file'
    );
  });
});

describe('dirname URI Scheme Preservation', () => {
  test('preserves file:/// URIs', () => {
    expect(dirname('file:///foo/bar/file.txt')).toBe('file:///foo/bar');
    expect(dirname('file:///foo/bar/')).toBe('file:///foo/bar');
    expect(dirname('file:///foo')).toBe('file:///');
    expect(dirname('file:///')).toBe('file:///');
  });

  test('preserves file:// URIs', () => {
    expect(dirname('file://server/share/file.txt')).toBe('file://server/share');
    expect(dirname('file://server/share')).toBe('file://server/');
    expect(dirname('file://server')).toBe('file://');
  });

  test('handles plain paths normally', () => {
    expect(dirname('/usr/local/bin/file.txt')).toBe('/usr/local/bin');
    expect(dirname('relative/path/file.txt')).toBe('relative/path');
    expect(dirname('file.txt')).toBe('.');
    expect(dirname('/')).toBe('/');
    expect(dirname('')).toBe('/');
  });

  test('handles other URI schemes', () => {
    expect(dirname('https://example.com/path/to/file')).toBe(
      'https://example.com/path/to'
    );
    expect(dirname('s3://bucket/path/file.txt')).toBe('s3://bucket/path');
    expect(dirname('ftp://host/path')).toBe('ftp://host/');
  });
});

describe('URI Scheme Edge Cases', () => {
  test('handles URIs with no path component', () => {
    expect(dirname('file:///')).toBe('file:///');
    expect(dirname('https://')).toBe('https:///');
    expect(joinPath('file:///')).toBe('file:///');
  });

  test('handles URIs with single slash after scheme', () => {
    expect(dirname('file://server')).toBe('file://');
    expect(dirname('file://server/')).toBe('file://server/');
    expect(joinPath('file://', 'server')).toBe('file://server');
  });

  test('preserves multiple slashes in URI schemes', () => {
    expect(joinPath('file:///', 'path')).toBe('file:///path');
    expect(joinPath('file:////', 'path')).toBe('file:////path');
  });
});

// Additional tests for other path utilities to ensure no regressions
describe('Path Utilities Regression Tests', () => {
  describe('basename', () => {
    test('extracts basename correctly', () => {
      expect(basename('/path/to/file.txt')).toBe('file.txt');
      expect(basename('file.txt')).toBe('file.txt');
      expect(basename('/path/to/')).toBe('to');
    });

    test('removes extension when specified', () => {
      expect(basename('/path/to/file.txt', '.txt')).toBe('file');
      expect(basename('file.txt', '.txt')).toBe('file');
    });
  });

  describe('extname', () => {
    test('extracts extension correctly', () => {
      expect(extname('file.txt')).toBe('.txt');
      expect(extname('/path/to/file.txt')).toBe('.txt');
      expect(extname('file')).toBe('');
      expect(extname('file.')).toBe('.');
    });
  });

  describe('resolvePath', () => {
    test('resolves paths correctly', () => {
      expect(resolvePath('/base', 'relative')).toBe('/base/relative');
      expect(resolvePath('/base', '/absolute')).toBe('/absolute');
      expect(resolvePath('/base/path', '..')).toBe('/base');
    });
  });

  describe('normalizePath', () => {
    test('normalizes paths correctly', () => {
      expect(normalizePath('/path//to///file')).toBe('/path/to/file');
      expect(normalizePath('./path/../other')).toBe('other');
      expect(normalizePath('path\\to\\file')).toBe('path/to/file');
    });
  });

  describe('isAbsolute', () => {
    test('detects absolute paths correctly', () => {
      expect(isAbsolute('/absolute')).toBe(true);
      expect(isAbsolute('relative')).toBe(false);
    });
  });

  describe('toPosixPath', () => {
    test('converts backslashes to forward slashes', () => {
      expect(toPosixPath('path\\to\\file')).toBe('path/to/file');
      expect(toPosixPath('/already/posix')).toBe('/already/posix');
    });
  });
});
