import type { AnalyticsClient } from '@/lib/analytics';
import { createConsentGatedAnalytics, NoopAnalytics } from '@/lib/analytics';
import { consentManager } from '@/lib/privacy/consent-manager';

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();

let baseClient: AnalyticsClient | null = null;
let activeClient: AnalyticsClient = NoopAnalytics;
let lastWrappedClient: AnalyticsClient | null = null;

function notify(): void {
  subscribers.forEach((listener) => {
    try {
      listener();
    } catch {
      // Listeners must be resilient; swallow errors to avoid breaking others.
    }
  });
}

function setActiveClient(nextClient: AnalyticsClient): void {
  if (activeClient === nextClient) return;
  activeClient = nextClient;
  notify();
}

function updateActiveClient(consented: boolean): void {
  if (!baseClient || !consented) {
    lastWrappedClient = null;
    setActiveClient(NoopAnalytics);
    return;
  }

  if (baseClient === lastWrappedClient) return;

  const wrapped = createConsentGatedAnalytics(baseClient);
  lastWrappedClient = baseClient;
  setActiveClient(wrapped);
}

consentManager.onConsentChanged('analytics', (consented) => {
  updateActiveClient(consented);
});

updateActiveClient(consentManager.hasConsented('analytics'));

export function setAnalyticsClient(
  client: AnalyticsClient | null | undefined
): void {
  baseClient = client ?? null;
  updateActiveClient(consentManager.hasConsented('analytics'));
}

export function getAnalyticsClient(): AnalyticsClient {
  return activeClient;
}

export function subscribe(listener: Subscriber): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
