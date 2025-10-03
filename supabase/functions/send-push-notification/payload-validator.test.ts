// @ts-nocheck
// Deno tests are kept for reference. tsc in this repo can't resolve remote Deno std imports.
// Use local imports for type-checking purposes only.
import { assertEquals, assertExists } from 'assert';
import {
  createTruncatedPayload,
  truncateNotificationBody,
  validatePayloadSize,
} from './payload-validator';

Deno.test('validatePayloadSize - accepts small payload', () => {
  const payload = {
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'Test',
    body: 'Short message',
    data: { link: '/post/123' },
  };

  const result = validatePayloadSize(payload);
  assertEquals(result.valid, true);
  assertEquals(result.truncated, undefined);
});

Deno.test('validatePayloadSize - rejects oversized payload', () => {
  const longBody = 'A'.repeat(4000); // 4000 bytes
  const payload = {
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'Test Notification',
    body: longBody,
    data: { deepLink: 'https://growbro.app/post/456', messageId: 'msg_123' },
  };

  const result = validatePayloadSize(payload);
  assertEquals(result.valid, false);
  assertExists(result.truncated);
  assertEquals(result.truncated!.endsWith('...'), true);
});

Deno.test('validatePayloadSize - handles metadata overhead', () => {
  const payload = {
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'Test',
    body: 'Body',
    data: {
      deepLink: 'https://growbro.app/post/456',
      messageId: 'msg_123',
      // Large data field
      metadata: 'X'.repeat(3900),
    },
  };

  const result = validatePayloadSize(payload);
  assertEquals(result.valid, false);
  assertEquals(
    result.reason,
    'Payload metadata exceeds safe limit; reduce data field size'
  );
});

Deno.test('truncateNotificationBody - handles ASCII text', () => {
  const body = 'This is a test message that needs truncation';
  const truncated = truncateNotificationBody(body, 20);

  assertEquals(truncated.endsWith('...'), true);
  const encoder = new TextEncoder();
  assertEquals(encoder.encode(truncated).length <= 20, true);
});

Deno.test('truncateNotificationBody - handles multi-byte UTF-8', () => {
  const body = 'Hello 👋 World 🌍 Test 🚀';
  const truncated = truncateNotificationBody(body, 20);

  assertEquals(truncated.endsWith('...'), true);
  const encoder = new TextEncoder();
  const size = encoder.encode(truncated).length;
  assertEquals(size <= 20, true);

  // Verify decoder can safely decode (no broken multi-byte chars)
  const decoder = new TextDecoder();
  const decoded = decoder.decode(encoder.encode(truncated));
  assertEquals(decoded, truncated);
});

Deno.test('truncateNotificationBody - handles German umlauts', () => {
  const body = 'Über große Änderungen müssen wir sprechen äöü';
  const truncated = truncateNotificationBody(body, 30);

  assertEquals(truncated.endsWith('...'), true);
  const encoder = new TextEncoder();
  assertEquals(encoder.encode(truncated).length <= 30, true);

  // No broken characters
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(encoder.encode(truncated)), truncated);
});

Deno.test('truncateNotificationBody - returns ellipsis when maxBytes too small', () => {
  const body = 'Test';
  const truncated = truncateNotificationBody(body, 2);

  assertEquals(truncated, '');
});

Deno.test('truncateNotificationBody - preserves exact fit', () => {
  const body = 'Exact';
  const encoder = new TextEncoder();
  const bodySize = encoder.encode(body).length;

  // Exactly body size + ellipsis
  const truncated = truncateNotificationBody(body, bodySize + 3);
  assertEquals(truncated, body + '...');
});

Deno.test('createTruncatedPayload - returns truncated copy', () => {
  const payload = {
    to: 'ExponentPushToken[test]',
    title: 'Test',
    body: 'A'.repeat(100),
    data: { link: '/post/123' },
  };

  const truncated = createTruncatedPayload(payload, 20);

  assertEquals(truncated.to, payload.to);
  assertEquals(truncated.title, payload.title);
  assertEquals(truncated.body.endsWith('...'), true);
  assertEquals(truncated.data, payload.data);

  const encoder = new TextEncoder();
  assertEquals(encoder.encode(truncated.body).length <= 20, true);
});

Deno.test('validatePayloadSize - real-world community notification', () => {
  const payload = {
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'New reply to your post',
    body: 'Someone replied: This is a thoughtful comment about your grow setup...',
    data: {
      deepLink: 'https://growbro.app/post/456',
      messageId: 'msg_123',
      type: 'community.reply',
      postId: 'post_456',
      replyId: 'reply_789',
    },
    sound: 'default',
    channelId: 'community.interactions.v1',
    categoryId: 'COMMUNITY_INTERACTIONS',
  };

  const result = validatePayloadSize(payload);
  assertEquals(result.valid, true); // Should fit under 4KB
});

Deno.test('validatePayloadSize - stress test at 3.9KB boundary', () => {
  const payload = {
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'Test Notification',
    body: 'A'.repeat(3700), // ~3.7KB body
    data: {
      deepLink: 'https://growbro.app/post/456',
      messageId: 'msg_123',
    },
  };

  const result = validatePayloadSize(payload);
  assertEquals(result.valid, true); // Should fit under 4KB with overhead
});

Deno.test('validatePayloadSize - stress test at 4.1KB (should fail)', () => {
  const payload = {
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'Test Notification',
    body: 'B'.repeat(4000), // 4KB body alone
    data: {
      deepLink: 'https://growbro.app/post/456',
      messageId: 'msg_123',
    },
  };

  const result = validatePayloadSize(payload);
  assertEquals(result.valid, false);
  assertExists(result.truncated);
  assertEquals(result.truncated!.endsWith('...'), true);

  // Verify truncated version would fit
  const truncatedPayload = {
    ...payload,
    body: result.truncated!,
  };
  const revalidated = validatePayloadSize(truncatedPayload);
  assertEquals(revalidated.valid, true);
});
