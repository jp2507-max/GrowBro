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
    if (this.flushing) return;

    this.flushing = true;
    try {
      // Simulate sequential delivery with rate limiting (max 5 events/sec)
      const throttleMs = 200;
      while (this.buffer.length > 0) {
        const next = this.buffer.shift() as Buffered;
        const requiredConsent = this.getRequiredConsentForEvent(
          next.event.name
        );

        // Check both required consent and SDK gate
        if (
          !this.hasRequiredConsent(requiredConsent) ||
          !SDKGate.isSDKAllowed(this.sdkName)
        ) {
          // Put back to head and abort
          this.buffer.unshift(next);
          this.bufferBytes += next.size;
          break;
        }

        this.bufferBytes -= next.size;
        // No real network send in minimal skeleton
        await new Promise((r) => setTimeout(r, throttleMs));
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
