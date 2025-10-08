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
export const getRandomBytes = jest.fn();
export const getRandomBytesAsync = jest.fn();
export const randomUUID = jest.fn();

export default {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
  getRandomBytesAsync,
  randomUUID,
};
