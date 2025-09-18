import { z } from 'zod';

import { ConsentService } from '@/lib/privacy/consent-service';
import type { ConsentState } from '@/lib/privacy/consent-types';
import { SDKGate } from '@/lib/privacy/sdk-gate';
import { hasConsent } from '@/lib/privacy-consent';

export type TelemetryEvent = {
  name: string;
  // Allow limited strings (IDs / categorical labels) in addition to primitive metrics.
  // Strings should be non-PII identifiers or small categorical values only.
  properties: Record<string, number | boolean | Date | string>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
};

const TelemetryEventSchema = z.object({
  name: z.string().min(1).max(64),
  properties: z.record(
    z.union([
      z.number(),
      z.boolean(),
      z.date(),
      z.string().min(1).max(128), // bounded strings only
    ])
  ),
  timestamp: z.date(),
  sessionId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128).optional(),
});

export type TelemetryBufferConfig = {
  maxBytes: number; // 10 * 1024 * 1024
  maxAgeMs: number; // 24h
  purgeOnConsentChange: boolean; // true
};

const DEFAULT_BUFFER_CONFIG: TelemetryBufferConfig = {
  maxBytes: 10 * 1024 * 1024,
  maxAgeMs: 24 * 60 * 60 * 1000,
  purgeOnConsentChange: true,
};

type Buffered = { event: TelemetryEvent; enqueuedAt: number; size: number };

function estimateSize(event: TelemetryEvent): number {
  // Lightweight size estimation without heavy JSON stringify each time
  let size = 0;
  size += event.name.length;
  size += event.sessionId.length;
  if (event.userId) size += event.userId.length;
  // Approx for properties
  for (const key of Object.keys(event.properties)) {
    size += key.length + 8; // key + primitive estimate
  }
  return size + 24; // timestamp + overhead
}

export type TelemetryClientOptions = {
  buffer?: TelemetryBufferConfig;
};

export class TelemetryClient {
  private buffer: Buffered[] = [];

  private bufferBytes = 0;

  private config: TelemetryBufferConfig;

  private dataMinimized = true;

  private consent: ConsentState | null = null;

  private flushing = false;

  // Promise representing the currently running flush (if any). Exposed so
  // callers can await an in-flight flush instead of returning early.
  private inFlightFlush: Promise<void> | null = null;

  // When events arrive while a flush is active, we set this flag so the
  // running flush can schedule a follow-up run after it completes. This
  // guarantees the queue will be drained eventually instead of leaving the
  // last burst of events buffered indefinitely.
  private flushRequested = false;

  private readonly sdkName = 'telemetry';

  constructor(options?: TelemetryClientOptions) {
    this.config = { ...DEFAULT_BUFFER_CONFIG, ...(options?.buffer ?? {}) };
    // Register with SDK gate to benefit from network safety net
    SDKGate.registerSDK(this.sdkName, 'telemetry', [
      'analytics',
      'sentry',
      'ingest',
    ]);
    SDKGate.installNetworkSafetyNet();

    // Prime consent state and subscribe to changes
    void ConsentService.getConsents().then((c) => {
      this.consent = c;
      // Flush queued events if telemetry consent was already granted
      if (c.telemetry && this.buffer.length > 0) {
        void this.flush();
      }
    });
    ConsentService.onChange((c) => {
      this.consent = c;
      if (this.config.purgeOnConsentChange && !c.telemetry) {
        this.clearQueue();
      }
      if (c.telemetry) {
        // attempt background flush
        void this.flush();
      }
    });
  }

  async track(event: TelemetryEvent): Promise<void> {
    const validated = TelemetryEventSchema.safeParse(event);
    if (!validated.success) return; // drop silently per minimization

    // Check consent based on event type
    const requiredConsent = this.getRequiredConsentForEvent(event.name);
    if (!this.hasRequiredConsent(requiredConsent)) {
      this.enqueue(event);
      return;
    }

    // With consent → enqueue then flush (apply backpressure sequentially)
    this.enqueue(event);
    await this.flush();
  }

  async identify(
    _userId: string,
    _traits?: Record<string, number | boolean | Date>
  ): Promise<void> {
    // Intentionally minimal; avoid attaching persistent identifiers client-side
    return;
  }

  async flush(): Promise<void> {
    // NOTE (P1): If a flush is already in progress, mark that another flush
    // was requested and return the existing in-flight promise. This ensures
    // callers get a promise they can await and that we will run a follow-up
    // flush after the current one finishes so newly enqueued events are not
    // left permanently buffered.
    if (this.flushing) {
      this.flushRequested = true;
      return this.inFlightFlush ?? Promise.resolve();
    }

    // Create and store the in-flight promise so concurrent callers can await
    // it instead of returning early. The promise will chain a follow-up
    // flush when needed.
    this.flushing = true;
    this.inFlightFlush = this.runFlushLoop();

    try {
      await this.inFlightFlush;
    } finally {
      // Clear stored in-flight promise and run another flush if requested
      // while the previous run was active.
      this.inFlightFlush = null;
      if (this.flushRequested) {
        this.flushRequested = false;
        // Schedule a follow-up flush; callers may await this new promise.
        await this.flush();
      }
    }
    return;
  }

  // Extracted flush loop to keep `flush()` concise and within line limits.
  private async runFlushLoop(): Promise<void> {
    try {
      // Simulate sequential delivery with rate limiting (max 5 events/sec)
      const throttleMs = 200;
      while (this.buffer.length > 0) {
        // Peek at head without removing so we only update accounting
        // after a successful delivery. This avoids double-counting when
        // delivery is aborted due to missing consent or SDK blocking.
        const next = this.buffer[0] as Buffered;
        const requiredConsent = this.getRequiredConsentForEvent(
          next.event.name
        );

        // Check both required consent and SDK gate. If delivery is not
        // allowed, abort and leave the queue and bufferBytes intact.
        if (
          !this.hasRequiredConsent(requiredConsent) ||
          !SDKGate.isSDKAllowed(this.sdkName)
        ) {
          break;
        }

        // Perform the send. Only remove from queue and adjust
        // bufferBytes after a successful delivery to keep accounting
        // consistent.
        // No real network send in minimal skeleton.
        await new Promise((r) => setTimeout(r, throttleMs));

        // After successful send, remove from the queue and update size
        // Defensive check: the queue may be mutated concurrently by
        // `clearQueue()` (or other callers) which resets `this.buffer` to
        // an empty array and sets `this.bufferBytes = 0`. If that happens
        // between the `await` above and this removal, `shift()` will
        // return `undefined` and accessing `.size` would throw. To avoid
        // crashing the in-flight flush, re-check the buffer length and
        // bail out of the loop if the queue was cleared.
        const removed = this.buffer.shift() as Buffered | undefined;
        if (!removed) {
          // Queue was cleared concurrently; nothing left to do.
          break;
        }
        this.bufferBytes -= removed.size;
      }
    } finally {
      this.flushing = false;
    }
  }

  async clearQueue(): Promise<void> {
    this.buffer = [];
    this.bufferBytes = 0;
  }

  setDataMinimization(enabled: boolean): void {
    this.dataMinimized = enabled;
  }

  rotatePseudonymousId(): void {
    // Placeholder: in minimal client we do not persist identifiers
  }

  // Internal helpers
  private hasTelemetryConsent(): boolean {
    try {
      return this.consent?.telemetry === true;
    } catch {
      return false;
    }
  }

  private getRequiredConsentForEvent(
    eventName: string
  ): 'telemetry' | 'analytics' {
    // Guided grow playbook events require analytics consent
    if (
      eventName.startsWith('playbook_') ||
      eventName.startsWith('ai_adjustment_') ||
      eventName.startsWith('trichome_')
    ) {
      return 'analytics';
    }

    // All other events use telemetry consent
    return 'telemetry';
  }

  private hasRequiredConsent(
    requiredConsent: 'telemetry' | 'analytics'
  ): boolean {
    if (requiredConsent === 'analytics') {
      // Check analytics consent from privacy-consent
      return hasConsent('analytics');
    } else {
      // Check telemetry consent from consent service
      return this.hasTelemetryConsent();
    }
  }

  private enqueue(event: TelemetryEvent): void {
    const now = Date.now();
    // drop expired events
    this.dropExpired(now);

    const size = estimateSize(event);
    // FIFO drop when exceeding buffer size
    while (
      this.buffer.length > 0 &&
      this.bufferBytes + size > this.config.maxBytes
    ) {
      const removed = this.buffer.shift() as Buffered;
      this.bufferBytes -= removed.size;
    }
    this.buffer.push({ event, enqueuedAt: now, size });
    this.bufferBytes += size;
    // If we enqueue while a flush is active, ensure a follow-up flush
    // is scheduled so newly buffered events will be delivered.
    if (this.flushing) this.flushRequested = true;
  }

  private dropExpired(nowMs: number): void {
    if (this.buffer.length === 0) return;
    const maxAge = this.config.maxAgeMs;
    let removedBytes = 0;
    this.buffer = this.buffer.filter((b) => {
      const keep = nowMs - b.enqueuedAt <= maxAge;
      if (!keep) removedBytes += b.size;
      return keep;
    });
    if (removedBytes > 0) this.bufferBytes -= removedBytes;
  }
}

export const telemetryClient = new TelemetryClient();
