// @ts-nocheck

/* eslint-disable max-lines-per-function -- Test file with comprehensive test cases that exceed line limits */
/* eslint-disable prettier/prettier -- Formatting conflicts with test readability */

import {
  sanitizeObjectPII,
  sanitizeTextPII,
} from '@/lib/sentry-utils';

describe('sentry-utils', () => {
  describe('sanitizeTextPII', () => {
    test('redacts email addresses', () => {
      const input = 'Contact support@example.com for help';
      const result = sanitizeTextPII(input);
      expect(result).toBe('Contact [EMAIL_REDACTED] for help');
    });

    test('redacts phone numbers', () => {
      const input = 'Call (555) 123-4567 or 555-123-4567';
      const result = sanitizeTextPII(input);
      expect(result).toBe('Call [PHONE_REDACTED] or [PHONE_REDACTED]');
    });

    test('redacts API keys', () => {
      const input = 'Bearer sk_live_1234567890abcdef';
      const result = sanitizeTextPII(input);
      expect(result).toBe('Bearer [API_KEY_REDACTED]');
    });

    test('handles multiple sensitive patterns', () => {
      const input = 'Email: test@example.com, Phone: 555-123-4567, API: sk_test_abcdef123456';
      const result = sanitizeTextPII(input);
      expect(result).toBe('Email: [EMAIL_REDACTED], Phone: [PHONE_REDACTED], API: [API_KEY_REDACTED]');
    });
  });

  describe('sanitizeObjectPII', () => {
    test('scrubs strings in objects', () => {
      const input = {
        email: 'user@example.com',
        name: 'John Doe',
        apiKey: 'sk_live_1234567890abcdef',
      };
      const result = sanitizeObjectPII(input);
      expect(result).toEqual({
        email: '[EMAIL_REDACTED]',
        name: 'John Doe',
        apiKey: '[API_KEY_REDACTED]',
      });
    });

    test('handles nested objects with maxDepth', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      sensitive: 'sk_live_deeplynested',
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = sanitizeObjectPII(input, 3);
      expect(result.level1.level2.level3).toBe('[MaxDepth]');
    });

    test('handles circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      const result = sanitizeObjectPII(obj);
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular]');
    });

    test('handles mixed-type arrays', () => {
      const input = [
        'user@example.com',
        42,
        { apiKey: 'sk_live_arrayitem' },
        null,
        undefined,
        true,
      ];
      const result = sanitizeObjectPII(input);
      expect(result).toEqual([
        '[EMAIL_REDACTED]',
        42,
        { apiKey: '[API_KEY_REDACTED]' },
        null,
        undefined,
        true,
      ]);
    });

    test('handles Maps', () => {
      const map = new Map();
      map.set('email', 'user@example.com');
      map.set('apiKey', 'sk_live_mapvalue');
      map.set(42, 'number key');
      const result = sanitizeObjectPII(map);
      expect(result).toEqual({
        email: '[EMAIL_REDACTED]',
        apiKey: '[API_KEY_REDACTED]',
        '42': 'number key',
      });
    });

    test('handles Sets', () => {
      const set = new Set([
        'user@example.com',
        'sk_live_setvalue',
        42,
      ]);
      const result = sanitizeObjectPII(set);
      expect(result).toEqual([
        '[EMAIL_REDACTED]',
        '[API_KEY_REDACTED]',
        42,
      ]);
    });

    test('handles Axios-like objects', () => {
      const axiosError = {
        config: {
          headers: {
            authorization: 'Bearer sk_live_configheader',
          },
          url: 'https://api.example.com',
        },
        request: {
          _header: 'authorization: Bearer sk_live_requestheader',
        },
        response: {
          data: {
            user: {
              email: 'user@example.com',
            },
          },
        },
        message: 'Request failed',
      };
      const result = sanitizeObjectPII(axiosError);
      expect(result.config.headers.authorization).toBe('[AUTH_HEADER_REDACTED]');
      expect(result.request._header).toBe('[AUTH_HEADER_REDACTED]');
      expect(result.response.data.user.email).toBe('[EMAIL_REDACTED]');
      expect(result.message).toBe('Request failed');
    });

    test('preserves Date objects', () => {
      const date = new Date('2020-01-01T00:00:00.000Z');
      const input = { created: date };
      const result = sanitizeObjectPII(input);
      expect(result.created).toBeInstanceOf(Date);
      expect(result.created.toISOString()).toBe(date.toISOString());
    });

    test('preserves RegExp objects', () => {
      const regex = /test/gi;
      const input = { pattern: regex };
      const result = sanitizeObjectPII(input);
      expect(result.pattern).toBeInstanceOf(RegExp);
      expect(result.pattern.toString()).toBe(regex.toString());
    });

    test('handles primitive types', () => {
      const input = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        bigint: BigInt(123),
        symbol: Symbol('test'),
      };
      const result = sanitizeObjectPII(input);
      expect(result).toEqual(input);
    });

    test('handles functions', () => {
      const func = () => 'test';
      const input = { callback: func };
      const result = sanitizeObjectPII(input);
      expect(result.callback).toBe(func);
    });

    test('handles complex nested structures', () => {
      const input = {
        users: [
          {
            email: 'user1@example.com',
            profile: {
              phone: '555-123-4567',
              address: '123 Main Street',
            },
          },
          {
            email: 'user2@example.com',
            apiKey: 'sk_live_user2key',
          },
        ],
        metadata: {
          requestId: 'req_123',
          timestamp: new Date('2020-01-01'),
        },
        config: {
          headers: {
            'x-api-key': 'pk_live_configkey',
          },
        },
      };
      const result = sanitizeObjectPII(input);
      expect(result.users[0].email).toBe('[EMAIL_REDACTED]');
      expect(result.users[0].profile?.phone).toBe('[PHONE_REDACTED]');
      expect(result.users[0].profile?.address).toBe('[ADDRESS_REDACTED]');
      expect(result.users[1].email).toBe('[EMAIL_REDACTED]');
      expect(result.users[1].apiKey).toBe('[API_KEY_REDACTED]');
      expect(result.metadata.requestId).toBe('req_123');
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(result.config.headers['x-api-key']).toBe('[SENSITIVE_HEADER_REDACTED]');
    });
  });
});