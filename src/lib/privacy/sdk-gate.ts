import {
  getPrivacyConsent,
  onPrivacyConsentChange,
} from '@/lib/privacy-consent';

import { ConsentService } from './consent-service';
import type { ConsentPurpose } from './consent-types';

type SDKStatus = 'uninitialized' | 'blocked' | 'allowed' | 'initialized';

type NetworkRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type SDKRegistryItem = {
  name: string;
  purpose: ConsentPurpose;
  hosts: string[]; // host substring matches (minimal, low-risk)
  status: SDKStatus;
  initialized: boolean;
  lastActivity?: string; // ISO string
};

function nowIso(): string {
  return new Date().toISOString();
}

function hasConsentForPurpose(purpose: ConsentPurpose): boolean {
  // Prefer legacy UI-driven consent but also honor stored ConsentService state
  let allowedByUI = false;
  try {
    const uiConsent = getPrivacyConsent();
    if (purpose === 'telemetry') allowedByUI = uiConsent.analytics === true;
    else if (purpose === 'crashDiagnostics')
      allowedByUI = uiConsent.crashReporting === true;
  } catch {}

  let allowedByStore = false;
  try {
    allowedByStore = ConsentService.hasConsent(purpose) === true;
  } catch {}

  return allowedByUI || allowedByStore;
}

class SDKGateImpl {
  private registry = new Map<string, SDKRegistryItem>();
  private safetyNetInstalled = false;

  constructor() {
    // React to consent changes to flip SDK statuses automatically
    ConsentService.onChange(() => {
      for (const item of this.registry.values()) {
        const allowed = hasConsentForPurpose(item.purpose);
        item.status = allowed ? 'allowed' : 'blocked';
      }
    });

    onPrivacyConsentChange(() => {
      for (const item of this.registry.values()) {
        const allowed = hasConsentForPurpose(item.purpose);
        item.status = allowed ? 'allowed' : 'blocked';
      }
    });
  }

  registerSDK(
    sdkName: string,
    purpose: ConsentPurpose,
    hosts: string[] = []
  ): void {
    const allowed = hasConsentForPurpose(purpose);
    const existing = this.registry.get(sdkName);
    const next: SDKRegistryItem = {
      name: sdkName,
      purpose,
      hosts: hosts.slice(),
      status: allowed ? 'allowed' : 'blocked',
      initialized: existing?.initialized ?? false,
      lastActivity: existing?.lastActivity,
    };
    this.registry.set(sdkName, next);
  }

  async initializeSDK(sdkName: string): Promise<void> {
    const item = this.registry.get(sdkName);
    if (!item) return;
    const allowed = hasConsentForPurpose(item.purpose);
    if (!allowed) {
      item.status = 'blocked';
      item.initialized = false;
      return; // no-op by design
    }
    item.status = 'initialized';
    item.initialized = true;
    item.lastActivity = nowIso();
  }

  blockSDK(sdkName: string): void {
    const item = this.registry.get(sdkName);
    if (!item) return;
    item.status = 'blocked';
    item.initialized = false;
  }

  isSDKAllowed(sdkName: string): boolean {
    const item = this.registry.get(sdkName);
    if (!item) return false;
    return hasConsentForPurpose(item.purpose) === true;
  }

  async interceptNetworkCall(
    request: NetworkRequest
  ): Promise<NetworkRequest | null> {
    const url = String(request.url || '');
    for (const item of this.registry.values()) {
      if (!hasConsentForPurpose(item.purpose)) {
        if (item.hosts.some((h) => (h && url.includes(h)) === true)) {
          return null; // blocked by consent
        }
      }
    }
    return request;
  }

  installNetworkSafetyNet(): void {
    if (this.safetyNetInstalled) return;
    this.safetyNetInstalled = true;

    const g = globalThis as typeof globalThis & { fetch: typeof fetch };
    const originalFetch = g.fetch;
    if (typeof originalFetch !== 'function') return;

    const self = this;
    g.fetch = function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ) {
      try {
        const url: string =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input instanceof Request
                ? input.url
                : '';
        for (const item of self.registry.values()) {
          if (!hasConsentForPurpose(item.purpose)) {
            if (item.hosts.some((h) => (h && url.includes(h)) === true)) {
              // Return a proper Response object to satisfy SDK expectations
              return Promise.resolve(new Response('', { status: 204 }));
            }
          }
        }
      } catch {
        // fall through to real fetch
      }
      return originalFetch(input, init);
    };
  }

  getSDKInventory(): {
    name: string;
    purpose: ConsentPurpose;
    region: 'EU' | 'US' | 'Global';
    dpaLink: string;
    initialized: boolean;
    lastActivity?: Date;
  }[] {
    // Minimal local inventory. Region/DPA link unknown client-side → placeholders.
    const inventory: {
      name: string;
      purpose: ConsentPurpose;
      region: 'EU' | 'US' | 'Global';
      dpaLink: string;
      initialized: boolean;
      lastActivity?: Date;
    }[] = [];
    for (const item of this.registry.values()) {
      inventory.push({
        name: item.name,
        purpose: item.purpose,
        region: 'EU',
        dpaLink: '#',
        initialized: item.initialized,
        lastActivity: item.lastActivity
          ? new Date(item.lastActivity)
          : undefined,
      });
    }
    return inventory;
  }

  updateSDKStatus(sdkName: string, status: SDKStatus): void {
    const item = this.registry.get(sdkName);
    if (!item) return;
    item.status = status;
    item.lastActivity = nowIso();
  }
}

export const SDKGate = new SDKGateImpl();
