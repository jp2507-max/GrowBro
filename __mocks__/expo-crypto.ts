/**
 * Mock for expo-crypto
 */

export enum CryptoDigestAlgorithm {
  SHA1 = 'SHA-1',
  SHA256 = 'SHA-256',
  SHA384 = 'SHA-384',
  SHA512 = 'SHA-512',
  MD2 = 'MD2',
  MD4 = 'MD4',
  MD5 = 'MD5',
}

export enum CryptoEncoding {
  HEX = 'hex',
  BASE64 = 'base64',
}

export const digestStringAsync = jest.fn();
export const getRandomBytes = jest.fn(() => new Uint8Array(32).fill(0));
export const getRandomBytesAsync = jest.fn(async (byteCount: number) =>
  new Uint8Array(byteCount).fill(0)
);
export const randomUUID = jest.fn(() => '00000000-0000-0000-0000-000000000000');

export default {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
  getRandomBytesAsync,
  randomUUID,
};
