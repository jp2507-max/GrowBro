import * as Crypto from 'expo-crypto';

import { supabase } from '../supabase';

export type IdempotencyParams<T> = {
  key: string;
  clientTxId: string;
  userId: string;
  endpoint: string;
  payload: any;
  operation: () => Promise<T>;
};

/**
 * Service for handling idempotency in community API operations
 * Ensures duplicate requests are handled correctly across retries and network failures
 */
export class IdempotencyService {
  // TTL used for completed idempotency records
  private readonly COMPLETED_TTL = '24 hours';
  // TTL used for failed idempotency records - extended for debugging
  private readonly FAILED_TTL = '7 days';

  /**
   * Process an operation with idempotency guarantees
   * Uses UPSERT pattern to handle concurrent requests safely
   */
  async processWithIdempotency<T>(params: IdempotencyParams<T>): Promise<T> {
    const { key, clientTxId, userId, endpoint, payload, operation } = params;
    const payloadHash = await this.computeHash(payload);

    try {
      const existing = await this.checkExistingKey(key, userId, endpoint);

      if (existing && existing.status === 'completed') {
        return this.handleCompletedKey(existing, payloadHash);
      }

      if (existing && existing.status === 'processing') {
        throw new Error('Request already being processed');
      }

      await this.markAsProcessing({
        key,
        clientTxId,
        userId,
        endpoint,
        payloadHash,
      });
      const result = await operation();
      await this.markAsCompleted({ key, userId, endpoint, result });

      return result;
    } catch (error) {
      await this.markAsFailed({ key, userId, endpoint, clientTxId, error });
      throw error;
    }
  }

  private async checkExistingKey(
    key: string,
    userId: string,
    endpoint: string
  ): Promise<any> {
    const { data, error } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('idempotency_key', key)
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check idempotency key: ${error.message}`);
    }

    return data;
  }

  private handleCompletedKey<T>(existing: any, payloadHash: string): T {
    if (existing.payload_hash !== payloadHash) {
      throw new Error(
        'Idempotency key conflict: different payload for same key'
      );
    }
    return existing.response_payload as T;
  }

  private async markAsProcessing(params: {
    key: string;
    clientTxId: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
  }): Promise<void> {
    const { key, clientTxId, userId, endpoint, payloadHash } = params;
    const { error } = await supabase.from('idempotency_keys').upsert(
      {
        idempotency_key: key,
        client_tx_id: clientTxId,
        user_id: userId,
        endpoint,
        payload_hash: payloadHash,
        status: 'processing',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'idempotency_key,user_id,endpoint' }
    );

    if (error) {
      throw new Error(`Failed to insert idempotency key: ${error.message}`);
    }
  }

  private async markAsCompleted(params: {
    key: string;
    userId: string;
    endpoint: string;
    result: any;
  }): Promise<void> {
    const { key, userId, endpoint, result } = params;
    const { error } = await supabase
      .from('idempotency_keys')
      .update({
        response_payload: result,
        status: 'completed',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('idempotency_key', key)
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Failed to update idempotency key:', error);
    }
  }

  private async markAsFailed(params: {
    key: string;
    userId: string;
    endpoint: string;
    clientTxId: string;
    error: unknown;
  }): Promise<void> {
    const { key, userId, endpoint, clientTxId, error } = params;
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Error',
      timestamp: new Date().toISOString(),
      endpoint,
      clientTxId,
    };

    await supabase
      .from('idempotency_keys')
      .update({
        status: 'failed',
        error_details: errorDetails,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq('idempotency_key', key)
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  }

  /**
   * Compute SHA-256 hash of payload for deduplication
   * Uses deterministic JSON serialization to ensure consistent hashes
   */
  private async computeHash(payload: any): Promise<string> {
    // Deterministic JSON serialization with sorted keys
    const normalized = this.deterministicStringify(payload);

    // Use expo-crypto to compute SHA-256 hash
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      normalized,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    return hash;
  }

  /**
   * Deterministically stringify a value by recursively sorting object keys
   */
  private deterministicStringify(value: any): string {
    if (value === null) return 'null';

    const t = typeof value;

    if (t === 'number') {
      return Number.isFinite(value) && !Number.isNaN(value)
        ? String(value)
        : 'null';
    }

    if (t === 'string') return JSON.stringify(value);

    if (t === 'boolean') return String(value);

    if (Array.isArray(value)) {
      const items = value.map((v) => this.deterministicStringify(v));
      return `[${items.join(',')}]`;
    }

    if (t === 'object') {
      const keys = Object.keys(value).sort();
      const pairs = keys.map(
        (k) => `"${k}":${this.deterministicStringify(value[k])}`
      );
      return `{${pairs.join(',')}}`;
    }

    // Undefined, functions, symbols -> treat as undefined
    return 'undefined';
  }

  /**
   * Clean up expired idempotency keys
   * Should be called periodically by a background job
   */
  async cleanupExpiredKeys(): Promise<void> {
    const { error } = await supabase
      .from('idempotency_keys')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .in('status', ['completed', 'failed']);

    if (error) {
      throw new Error(`Failed to cleanup expired keys: ${error.message}`);
    }
  }
}

// Singleton instance
let idempotencyServiceInstance: IdempotencyService | null = null;

/**
 * Get the singleton idempotency service instance
 */
export function getIdempotencyService(): IdempotencyService {
  if (!idempotencyServiceInstance) {
    idempotencyServiceInstance = new IdempotencyService();
  }
  return idempotencyServiceInstance;
}
