/**
 * Tests for security constants, particularly PII pattern validation
 */

import { PII_PATTERNS } from './constants';

describe('PII_PATTERNS', () => {
  describe('ipv4 pattern', () => {
    const ipv4Pattern = PII_PATTERNS.find((p) => p.name === 'ipv4')!.pattern;

    test('redacts valid IPv4 addresses', () => {
      const testCases = [
        '192.168.0.1',
        '10.0.0.1',
        '172.16.0.1',
        '127.0.0.1',
        '255.255.255.255',
        '8.8.8.8',
      ];

      testCases.forEach((ip) => {
        const result = ip.replace(ipv4Pattern, '[IP_REDACTED]');
        expect(result).toBe('[IP_REDACTED]');
      });
    });

    test('does not redact invalid IP addresses or low-numbered IPs', () => {
      const testCases = [
        '256.1.1.1', // Invalid: octet > 255
        '1.256.1.1', // Invalid: octet > 255
        '1.1.256.1', // Invalid: octet > 255
        '1.1.1.256', // Invalid: octet > 255
        '999.999.999.999', // Invalid: octet > 255
        '0.0.0.0', // Not matched: first octet < 10 (avoids version-like strings)
        '1.2.3.4', // Not matched: first octet < 10 (avoids version-like strings)
        '2.1.0.5', // Not matched: first octet < 10 (avoids version-like strings)
      ];

      testCases.forEach((nonMatchingIp) => {
        const result = nonMatchingIp.replace(ipv4Pattern, '[IP_REDACTED]');
        expect(result).toBe(nonMatchingIp); // Should remain unchanged
      });
    });

    test('redacts IPs in context but not version strings', () => {
      const testText = `
        Connecting to server at 192.168.0.1 on port 8080.
        App version is 1.2.3.4 and build 2.1.0.5.
        Database host: 10.0.0.1
        API version: 0.1.2.3
      `;

      const result = testText.replace(ipv4Pattern, '[IP_REDACTED]');

      // IPs should be redacted
      expect(result).toContain('[IP_REDACTED]');
      expect(result).not.toContain('192.168.0.1');
      expect(result).not.toContain('10.0.0.1');

      // Version strings should remain
      expect(result).toContain('1.2.3.4');
      expect(result).toContain('2.1.0.5');
      expect(result).toContain('0.1.2.3');
    });

    test('handles edge cases with word boundaries', () => {
      const testCases = [
        { input: 'ip:192.168.0.1', shouldRedact: true },
        { input: 'host=192.168.0.1', shouldRedact: true },
        { input: 'version:1.2.3.4', shouldRedact: false },
        { input: '(192.168.0.1)', shouldRedact: true },
        { input: 'build-1.2.3.4', shouldRedact: false },
      ];

      testCases.forEach(({ input, shouldRedact }) => {
        const result = input.replace(ipv4Pattern, '[IP_REDACTED]');
        if (shouldRedact) {
          expect(result).toContain('[IP_REDACTED]');
          expect(result).not.toContain('192.168.0.1');
        } else {
          expect(result).toBe(input);
        }
      });
    });
  });

  describe('other PII patterns', () => {
    test('email pattern works correctly', () => {
      const emailPattern = PII_PATTERNS.find(
        (p) => p.name === 'email'
      )!.pattern;

      expect('user@example.com'.replace(emailPattern, '[EMAIL_REDACTED]')).toBe(
        '[EMAIL_REDACTED]'
      );
      expect(
        'test.email@domain.co.uk'.replace(emailPattern, '[EMAIL_REDACTED]')
      ).toBe('[EMAIL_REDACTED]');
      expect('not-an-email'.replace(emailPattern, '[EMAIL_REDACTED]')).toBe(
        'not-an-email'
      );
    });

    test('jwt pattern works correctly', () => {
      const jwtPattern = PII_PATTERNS.find((p) => p.name === 'jwt')!.pattern;

      const sampleJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZXN0Ijoic2FtcGxlLWp3dCIsInB1cnBvc2UiOiJzZWN1cml0eS10ZXN0aW5nIn0.dGVzdC1zaWduYXR1cmU';
      expect(sampleJwt.replace(jwtPattern, '[JWT_REDACTED]')).toBe(
        '[JWT_REDACTED]'
      );
      expect('not-a-jwt'.replace(jwtPattern, '[JWT_REDACTED]')).toBe(
        'not-a-jwt'
      );
    });

    test('uuid pattern works correctly', () => {
      const uuidPattern = PII_PATTERNS.find((p) => p.name === 'uuid')!.pattern;

      const sampleUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(sampleUuid.replace(uuidPattern, '[UUID_REDACTED]')).toBe(
        '[UUID_REDACTED]'
      );
      expect('not-a-uuid'.replace(uuidPattern, '[UUID_REDACTED]')).toBe(
        'not-a-uuid'
      );
    });
  });
});
