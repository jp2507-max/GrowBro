# 15. Data Export and Backup Specification

## Overview

This specification defines the requirements for secure data export and backup functionality in GrowBro, ensuring user data protection through proper encryption, integrity verification, and key management practices.

## Key Security Requirements

### 15.1 Key Derivation and Separation

**Current Issue:** The spec currently derives an HMAC key from the passphrase but does not enforce key separation or labeled subkeys.

**Updated Requirement:** The implementation MUST derive distinct subkeys for encryption and MAC operations using a Key Derivation Function (KDF) that supports context/labels.

#### Supported KDF Methods

The implementation MUST support at least one of the following KDF methods:

1. **libsodium crypto_kdf** with different context strings
2. **HKDF-SHA256** with distinct info strings

#### Key Derivation Process

```typescript
// Example key derivation structure
interface KeyDerivationResult {
  encryptionKey: Uint8Array; // 32 bytes
  macKey: Uint8Array; // 32 bytes
  salt: Uint8Array; // 16 bytes (for HKDF) or 16 bytes (for crypto_kdf)
}

// HKDF-SHA256 example
function deriveKeysHKDF(
  passphrase: string,
  salt: Uint8Array
): KeyDerivationResult {
  const masterKey = HKDF.extract(passphrase, salt);
  const encryptionKey = HKDF.expand(masterKey, 'ENCRYPTION', 32);
  const macKey = HKDF.expand(masterKey, 'MANIFEST_HMAC', 32);
  return { encryptionKey, macKey, salt };
}

// libsodium crypto_kdf example
function deriveKeysSodium(
  passphrase: string,
  salt: Uint8Array
): KeyDerivationResult {
  const masterKey = crypto_pwhash(
    crypto_kdf_KEYBYTES,
    passphrase,
    salt,
    crypto_pwhash_OPSLIMIT_INTERACTIVE,
    crypto_pwhash_MEMLIMIT_INTERACTIVE,
    crypto_pwhash_ALG_DEFAULT
  );

  const encryptionKey = crypto_kdf_derive_from_key(32, 'ENCRYPTION', masterKey);
  const macKey = crypto_kdf_derive_from_key(32, 'MANIFEST_HMAC', masterKey);

  return { encryptionKey, macKey, salt };
}
```

### 15.2 Manifest Structure

The export manifest MUST include the following fields to document the cryptographic parameters:

```typescript
interface ExportManifest {
  version: string;
  createdAt: string;
  kdf: 'HKDF-SHA256' | 'crypto_kdf';
  salt: string; // base64-encoded salt
  subkeys: SubkeySpec[];
  signature: ManifestSignature;
  // ... other export metadata
}

interface SubkeySpec {
  name: 'enc' | 'mac';
  label: string; // e.g., "ENCRYPTION", "MANIFEST_HMAC"
  len: number; // key length in bytes (must be 32)
}

interface ManifestSignature {
  algorithm: 'HMAC-SHA256';
  subkeyLabel: string; // Must reference the MAC subkey label
  value: string; // base64-encoded HMAC value
}
```

**Example Manifest:**

```json
{
  "version": "1.0",
  "createdAt": "2025-09-10T12:00:00Z",
  "kdf": "HKDF-SHA256",
  "salt": "dGVzdGluZ3NhbHQxMjM0NTY=",
  "subkeys": [
    {
      "name": "enc",
      "label": "ENCRYPTION",
      "len": 32
    },
    {
      "name": "mac",
      "label": "MANIFEST_HMAC",
      "len": 32
    }
  ],
  "signature": {
    "algorithm": "HMAC-SHA256",
    "subkeyLabel": "MANIFEST_HMAC",
    "value": "aGV4ZW5jb2RlZGhtYWN2YWx1ZQ=="
  }
}
```

### 15.3 Key Separation Enforcement

**Critical Requirement:** The implementation MUST ensure that:

1. Encryption and MAC keys are NEVER derived from the same subkey
2. Keys MUST be derived using distinct context/label strings
3. Keys MUST be of equal length (32 bytes) for consistency
4. The manifest MUST document both subkey labels and their purposes

**Implementation MUST NOT:**

- Reuse the same key for both encryption and authentication
- Use generic or undocumented labels
- Allow key lengths other than 32 bytes for AES-256/HMAC-SHA256

### 15.4 Tamper Detection

The implementation MUST provide robust tamper detection through:

1. **Manifest Integrity:** HMAC-SHA256 of the entire manifest (excluding the signature field) using the dedicated MAC subkey
2. **Data Integrity:** Separate integrity verification for exported data files
3. **Verification Process:** On import, recalculate HMAC and compare with stored value

```typescript
function verifyManifestIntegrity(
  manifest: ExportManifest,
  macKey: Uint8Array
): boolean {
  // Create canonical JSON representation (sorted keys, no signature field)
  const canonicalManifest = createCanonicalManifest(manifest);
  const calculatedHmac = hmacSha256(macKey, canonicalManifest);
  const storedHmac = base64.decode(manifest.signature.value);

  return crypto.timingSafeEqual(calculatedHmac, storedHmac);
}
```

## Implementation Requirements

### 15.5 Core Functions

```typescript
interface DataExportAPI {
  // Key derivation
  deriveExportKeys(passphrase: string): Promise<KeyDerivationResult>;

  // Export process
  exportData(data: unknown, passphrase: string): Promise<ExportResult>;

  // Import process with verification
  importData(
    manifest: ExportManifest,
    encryptedData: Uint8Array,
    passphrase: string
  ): Promise<ImportResult>;

  // Verification functions
  verifyManifest(manifest: ExportManifest, macKey: Uint8Array): boolean;
  verifyDataIntegrity(
    data: Uint8Array,
    expectedHmac: string,
    macKey: Uint8Array
  ): boolean;
}
```

### 15.6 Error Handling

The implementation MUST handle the following error conditions:

1. **Invalid Passphrase:** Clear error message without revealing key derivation details
2. **Tampered Manifest:** Specific error indicating manifest integrity failure
3. **Key Derivation Failure:** Graceful fallback with user guidance
4. **Unsupported KDF:** Clear error indicating version incompatibility

## Testing Requirements

### 15.7 Unit Tests

The implementation MUST include comprehensive tests covering:

```typescript
describe('Key Derivation', () => {
  test('derives distinct encryption and MAC keys', async () => {
    const result = await deriveExportKeys('test-passphrase');

    // Keys must be different
    expect(result.encryptionKey).not.toEqual(result.macKey);

    // Keys must be correct length
    expect(result.encryptionKey.length).toBe(32);
    expect(result.macKey.length).toBe(32);
  });

  test('uses correct KDF labels', async () => {
    const result = await deriveExportKeys('test-passphrase');

    // Verify labels are used correctly in manifest
    expect(manifest.subkeys).toContainEqual({
      name: 'enc',
      label: 'ENCRYPTION',
      len: 32,
    });
    expect(manifest.subkeys).toContainEqual({
      name: 'mac',
      label: 'MANIFEST_HMAC',
      len: 32,
    });
  });
});

describe('Tamper Detection', () => {
  test('detects manifest tampering', async () => {
    const originalManifest = createTestManifest();
    const macKey = deriveMacKey('test-passphrase');

    // Verify original manifest passes
    expect(verifyManifest(originalManifest, macKey)).toBe(true);

    // Tamper with manifest
    const tamperedManifest = { ...originalManifest, version: '2.0' };

    // Verify tampered manifest fails
    expect(verifyManifest(tamperedManifest, macKey)).toBe(false);
  });

  test('detects key reuse attempts', async () => {
    // This test should fail to compile or run if keys are reused
    const keys = await deriveExportKeys('test-passphrase');

    // Attempting to use encryption key for MAC should be prevented
    expect(() => {
      hmacSha256(keys.encryptionKey, 'test-data');
    }).toThrow('Key separation violation');
  });
});
```

### 15.8 Integration Tests

1. **End-to-End Export/Import:** Verify complete export-import cycle with key verification
2. **Cross-Platform Compatibility:** Test exports created on different platforms
3. **Version Compatibility:** Test import of exports from previous versions
4. **Performance Testing:** Verify key derivation performance meets requirements

## Security Considerations

### 15.9 Cryptographic Parameters

- **Key Length:** 32 bytes (256 bits) for both encryption and MAC keys
- **Salt Length:** 16 bytes for HKDF, 16 bytes for crypto_kdf
- **HMAC Algorithm:** HMAC-SHA256 for manifest integrity
- **Encryption Algorithm:** AES-256-GCM (recommended) or ChaCha20-Poly1305

### 15.10 Key Management

- **Passphrase Requirements:** Minimum 12 characters, enforce complexity rules
- **Salt Generation:** Use cryptographically secure random generation
- **Key Lifetime:** Keys exist only in memory during export/import operations
- **Secure Erasure:** Zero out key material after use

### 15.11 Compliance

- **Data Protection:** Ensure compliance with GDPR, CCPA, and other privacy regulations
- **Export Controls:** Consider cryptographic export restrictions
- **Audit Trail:** Maintain logs of export/import operations (without storing keys)

## Future Considerations

### 15.12 Enhancements

1. **Hardware Security:** Support for hardware-backed key derivation (HSM, Secure Enclave)
2. **Multi-Factor:** Additional authentication factors beyond passphrase
3. **Key Rotation:** Support for key rotation in long-term backups
4. **Backup Sync:** Encrypted backup synchronization across devices

## Path Utilities Implementation

### 16.1 PathHelper URI Scheme Preservation

**Issue:** The PathHelper currently strips leading slashes and thus corrupts file:// URIs (e.g. file:///...) during path operations.

**Solution:** Both `joinPath` and `dirname` functions must detect and preserve URI scheme prefixes before normalizing path operations.

#### Implementation Details

```typescript
// URI scheme detection regex
const SCHEME_REGEX = /^([a-zA-Z]+:(?:\/\/?))(.*)$/;

// Modified joinPath function
export function joinPath(...segments: string[]): string {
  const processedSegments = segments
    .filter((segment) => segment && segment.trim() !== '')
    .map((segment) => {
      // Parse URI scheme prefix (e.g., file://, http://, https://)
      const schemeMatch = segment.match(SCHEME_REGEX);
      if (schemeMatch) {
        const [, scheme, pathPart] = schemeMatch;
        // Only trim slashes from the path portion, preserve scheme
        const trimmedPath = pathPart.replace(/^[\/\\]+|[\/\\]+$/g, '');
        return scheme + trimmedPath;
      }
      // No scheme, apply normal trimming
      return segment.replace(/^[\/\\]+|[\/\\]+$/g, '');
    });

  if (processedSegments.length === 0) {
    return '';
  }

  const path = processedSegments.join('/');

  // Handle leading slash preservation for URI schemes
  const firstSegment = segments.find(
    (segment) => segment && segment.trim() !== ''
  );
  if (!firstSegment) {
    return path;
  }

  const schemeMatch = firstSegment.match(SCHEME_REGEX);
  if (schemeMatch) {
    const [, scheme, pathPart] = schemeMatch;
    // Preserve original leading slash structure
    const originalHadLeadingSlash =
      pathPart.startsWith('/') || pathPart.startsWith('\\');
    const resultPath =
      scheme +
      (originalHadLeadingSlash && !path.startsWith('/') ? '/' : '') +
      path.replace(scheme, '');
    return resultPath;
  }

  // Standard path handling for non-URI paths
  const hasLeadingSlash = segments.some(
    (segment) => segment.startsWith('/') || segment.startsWith('\\')
  );

  return hasLeadingSlash && !path.startsWith('/') && !path.startsWith('\\')
    ? '/' + path
    : path;
}

// Modified dirname function
export function dirname(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  // Parse URI scheme prefix
  const schemeMatch = path.match(SCHEME_REGEX);
  if (schemeMatch) {
    const [, scheme, pathPart] = schemeMatch;

    // Handle edge cases for URI paths
    if (!pathPart || pathPart === '/') {
      return scheme + '/';
    }

    // Normalize path separators to forward slashes
    const normalizedPath = pathPart.replace(/\\/g, '/');

    // Remove trailing slashes except for root
    const trimmedPath = normalizedPath.replace(/\/+$/, '');

    // If no slashes remain, return scheme with current directory
    if (!trimmedPath.includes('/')) {
      return scheme + (trimmedPath.startsWith('/') ? '/' : '');
    }

    // Get everything before the last slash
    const lastSlashIndex = trimmedPath.lastIndexOf('/');
    if (lastSlashIndex === 0) {
      return scheme + '/';
    }

    return scheme + trimmedPath.substring(0, lastSlashIndex);
  }

  // Standard path handling for non-URI paths
  const normalizedPath = path.replace(/\\/g, '/');
  const trimmedPath = normalizedPath.replace(/\/+$/, '');

  if (!trimmedPath.includes('/')) {
    return '.';
  }

  const lastSlashIndex = trimmedPath.lastIndexOf('/');
  if (lastSlashIndex === 0) {
    return '/';
  }

  return trimmedPath.substring(0, lastSlashIndex);
}
```

#### Test Coverage Requirements

The implementation MUST include comprehensive tests covering:

```typescript
describe('PathHelper URI Scheme Preservation', () => {
  describe('joinPath', () => {
    test('preserves file:/// URIs', () => {
      expect(joinPath('file:///', 'foo', 'bar')).toBe('file:///foo/bar');
      expect(joinPath('file:///path', 'to', 'file.txt')).toBe(
        'file:///path/to/file.txt'
      );
    });

    test('preserves file:// URIs', () => {
      expect(joinPath('file://', 'server', 'share', 'file.txt')).toBe(
        'file://server/share/file.txt'
      );
    });

    test('handles plain paths normally', () => {
      expect(joinPath('/usr', 'local', 'bin')).toBe('/usr/local/bin');
      expect(joinPath('relative', 'path')).toBe('relative/path');
    });

    test('handles mixed URI and plain segments', () => {
      expect(joinPath('file:///', '/absolute', 'path')).toBe(
        'file:///absolute/path'
      );
      expect(joinPath('https://', 'example.com', '/api')).toBe(
        'https://example.com/api'
      );
    });
  });

  describe('dirname', () => {
    test('preserves file:/// URIs', () => {
      expect(dirname('file:///foo/bar/file.txt')).toBe('file:///foo/bar');
      expect(dirname('file:///foo/bar/')).toBe('file:///foo/bar');
      expect(dirname('file:///foo')).toBe('file:///');
      expect(dirname('file:///')).toBe('file:///');
    });

    test('preserves file:// URIs', () => {
      expect(dirname('file://server/share/file.txt')).toBe(
        'file://server/share'
      );
      expect(dirname('file://server/share')).toBe('file://server/');
    });

    test('handles plain paths normally', () => {
      expect(dirname('/usr/local/bin/file.txt')).toBe('/usr/local/bin');
      expect(dirname('relative/path/file.txt')).toBe('relative/path');
      expect(dirname('file.txt')).toBe('.');
    });
  });
});
```

#### Key Behaviors

1. **URI Scheme Detection:** Uses regex `^([a-zA-Z]+:(?:\/\/?))(.*)$` to parse schemes like `file://`, `https://`, etc.

2. **Path Portion Isolation:** Operates only on the path portion after the scheme, preserving the scheme itself.

3. **Leading Slash Preservation:** Maintains the original leading slash structure from the input URI:

   - `file:///foo` → `file:///foo` (triple slash preserved)
   - `file://server/share` → `file://server/share` (double slash preserved)

4. **Edge Case Handling:** Properly handles root URIs, empty paths, and mixed absolute/relative components.

### 16.2 Exit Criteria

- [ ] PathHelper URI preservation implementation completed
- [ ] Unit tests pass for file:///, file://, and plain paths
- [ ] Integration tests verify path operations in data export workflows
- [ ] No regressions in existing path utility functionality

## Exit Criteria

- [ ] All unit tests pass with >95% coverage
- [ ] Key separation tests verify distinct encryption/MAC keys
- [ ] Tamper detection tests confirm integrity verification
- [ ] Manifest validation tests ensure proper schema compliance
- [ ] Performance tests meet 500ms key derivation target
- [ ] Security audit completed with no high-severity issues
- [ ] Cross-platform compatibility verified (iOS, Android, Web)
- [ ] PathHelper URI preservation tests pass
