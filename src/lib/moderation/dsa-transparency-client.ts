/**
 * DSA Transparency Database API Client
 *
 * Implements submission to the EU Commission's DSA Transparency Database with:
 * - Batch API support (1-100 SoRs per request)
 * - Single submission fallback
 * - Retry logic with exponential backoff
 * - Permanent vs transient error detection
 * - Response tracking with Commission DB ID storage
 *
 * Requirements: 3.4 (submit redacted SoR without undue delay), 6.5 (structured export formats)
 */

import { Env } from '@env';
import * as Crypto from 'expo-crypto';

import type { RedactedSoR } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface DSASubmissionRequest {
  statements: RedactedSoR[];
  idempotency_key?: string;
}

export interface DSASubmissionResponse {
  success: boolean;
  submitted_count: number;
  failed_count: number;
  results: DSASubmissionResult[];
}

export interface DSASubmissionResponseWithDuration
  extends DSASubmissionResponse {
  duration_ms: number;
}

export interface DSASubmissionResult {
  decision_id: string;
  transparency_db_id?: string;
  status: 'submitted' | 'failed';
  error?: DSASubmissionError;
}

export interface DSASubmissionError {
  code: string;
  message: string;
  is_permanent: boolean;
}

export interface DSABatchSubmissionStats {
  total_attempts: number;
  successful: number;
  failed: number;
  duration_ms: number;
}

export interface RetryConfig {
  max_attempts: number;
  base_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  request_timeout_ms: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 5,
  base_delay_ms: 1000,
  max_delay_ms: 30000,
  backoff_multiplier: 2,
  request_timeout_ms: 30000,
};

const BATCH_SIZE_MAX = 100;
const BATCH_SIZE_MIN = 1;

/**
 * HTTP status codes that indicate permanent errors (don't retry)
 */
const PERMANENT_ERROR_CODES = [
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  409, // Conflict (duplicate submission)
  422, // Unprocessable Entity
];

// ============================================================================
// DSA Transparency Client
// ============================================================================

export class DSATransparencyClient {
  private baseUrl: string;
  private apiKey: string;
  private retryConfig: RetryConfig;

  constructor(
    baseUrl?: string,
    apiKey?: string,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.baseUrl = baseUrl || Env.DSA_TRANSPARENCY_DB_URL || '';
    this.apiKey = apiKey || Env.DSA_TRANSPARENCY_DB_API_KEY || '';
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...retryConfig,
    };

    if (!this.baseUrl) {
      throw new Error(
        'DSA_TRANSPARENCY_DB_URL environment variable is required'
      );
    }
  }

  /**
   * Submit batch of redacted SoRs to Commission Transparency Database.
   *
   * Batch size: 1-100 statements per request.
   * Falls back to single submission if batch fails.
   *
   * Requirements: 3.4, 6.5
   */
  async submitBatch(
    statements: RedactedSoR[],
    idempotencyKey?: string
  ): Promise<DSASubmissionResponseWithDuration> {
    const startTime = Date.now();

    // Validate batch size
    if (statements.length < BATCH_SIZE_MIN) {
      throw new Error(
        `Batch size must be at least ${BATCH_SIZE_MIN}, got ${statements.length}`
      );
    }

    if (statements.length > BATCH_SIZE_MAX) {
      throw new Error(
        `Batch size must be at most ${BATCH_SIZE_MAX}, got ${statements.length}`
      );
    }

    try {
      // Try batch submission first
      const response = await this.submitBatchRequest({
        statements,
        idempotency_key: idempotencyKey,
      });

      const duration = Date.now() - startTime;

      return {
        ...response,
        // Add duration to response (for metrics)
        duration_ms: duration,
      };
    } catch (error) {
      // If batch fails, fall back to single submissions
      if (statements.length > 1) {
        return await this.fallbackToSingleSubmissions(
          statements,
          idempotencyKey,
          startTime
        );
      }

      // Single statement batch failed, throw error
      throw error;
    }
  }

  /**
   * Submit single redacted SoR to Commission Transparency Database.
   *
   * Requirements: 3.4
   */
  async submitSingle(
    statement: RedactedSoR,
    idempotencyKey?: string
  ): Promise<DSASubmissionResult> {
    const response = await this.submitBatch([statement], idempotencyKey);

    if (response.results.length === 0) {
      throw new Error('No results returned from submission');
    }

    return response.results[0];
  }

  /**
   * Submit batch request with retry logic.
   */
  private async submitBatchRequest(
    request: DSASubmissionRequest
  ): Promise<DSASubmissionResponse> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.retryConfig.max_attempts) {
      attempt++;

      try {
        const response = await this.makeApiRequest(request);

        // Success
        return response;
      } catch (error) {
        lastError = error as Error;

        // Check if error is permanent (don't retry)
        if (this.isPermanentError(error)) {
          throw error;
        }

        // Check if we should retry
        if (attempt >= this.retryConfig.max_attempts) {
          break;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(attempt);

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw new Error(
      `Failed to submit after ${this.retryConfig.max_attempts} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Make API request to DSA Transparency Database.
   */
  private async makeApiRequest(
    request: DSASubmissionRequest
  ): Promise<DSASubmissionResponse> {
    const url = `${this.baseUrl}/api/v1/submissions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (request.idempotency_key) {
      headers['Idempotency-Key'] = request.idempotency_key;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.retryConfig.request_timeout_ms
    );
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          statements: request.statements,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(
        `DSA API error (${response.status}): ${errorBody}`
      );
      (error as any).statusCode = response.status;
      (error as any).isPermanent = PERMANENT_ERROR_CODES.includes(
        response.status
      );
      throw error;
    }

    // Parse response
    const data = await response.json();

    return this.parseSubmissionResponse(data);
  }

  /**
   * Parse API response into typed result.
   */
  private parseSubmissionResponse(data: any): DSASubmissionResponse {
    const results: DSASubmissionResult[] = (data.results || []).map(
      (result: any) => ({
        decision_id: result.decision_id,
        transparency_db_id: result.transparency_db_id,
        status: result.status || 'failed',
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              is_permanent: result.error.is_permanent || false,
            }
          : undefined,
      })
    );

    return {
      success: data.success || false,
      submitted_count: data.submitted_count || 0,
      failed_count: data.failed_count || 0,
      results,
    };
  }

  /**
   * Fallback to single submissions when batch fails.
   */
  private async fallbackToSingleSubmissions(
    statements: RedactedSoR[],
    idempotencyKey?: string,
    startTime: number = Date.now()
  ): Promise<DSASubmissionResponseWithDuration> {
    const results: DSASubmissionResult[] = [];
    let submittedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Derive stable per-statement idempotency key
      let statementIdempotencyKey: string | undefined;
      if (idempotencyKey) {
        const keyInput = `${idempotencyKey}:${statement.decision_id}:${i}`;
        statementIdempotencyKey = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          keyInput,
          { encoding: Crypto.CryptoEncoding.HEX }
        );
      }

      try {
        const result = await this.submitSingle(
          statement,
          statementIdempotencyKey
        );
        results.push(result);

        if (result.status === 'submitted') {
          submittedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        results.push({
          decision_id: statement.decision_id,
          status: 'failed',
          error: {
            code: 'SUBMISSION_FAILED',
            message: (error as Error).message,
            is_permanent: this.isPermanentError(error),
          },
        });
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      submitted_count: submittedCount,
      failed_count: failedCount,
      results,
      duration_ms: Date.now() - startTime,
    };
  }

  /**
   * Check if error is permanent (don't retry).
   */
  private isPermanentError(error: any): boolean {
    if (error?.isPermanent) {
      return true;
    }

    if (error?.statusCode) {
      return PERMANENT_ERROR_CODES.includes(error.statusCode);
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay =
      this.retryConfig.base_delay_ms *
      Math.pow(this.retryConfig.backoff_multiplier, attempt - 1);

    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);

    // Cap at max delay
    return Math.min(delay + jitter, this.retryConfig.max_delay_ms);
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get client configuration.
   */
  getConfig(): {
    baseUrl: string;
    retryConfig: RetryConfig;
  } {
    return {
      baseUrl: this.baseUrl,
      retryConfig: { ...this.retryConfig },
    };
  }

  /**
   * Update client configuration.
   */
  updateConfig(config: {
    baseUrl?: string;
    apiKey?: string;
    retryConfig?: Partial<RetryConfig>;
  }): void {
    if (config.baseUrl !== undefined) {
      this.baseUrl = config.baseUrl;
    }

    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    }

    if (config.retryConfig) {
      this.retryConfig = {
        ...this.retryConfig,
        ...config.retryConfig,
      };
    }
  }
}

// Export singleton instance
export const dsaTransparencyClient = new DSATransparencyClient();

// Export class for testing with custom config
export { DSATransparencyClient as DSATransparencyClientClass };
