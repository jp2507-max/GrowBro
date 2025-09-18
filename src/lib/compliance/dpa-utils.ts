export type ProcessorRegion = 'EU' | 'US' | 'Global';

export type ProcessorConfig = {
  name: string;
  purpose:
    | 'telemetry'
    | 'crashDiagnostics'
    | 'experiments'
    | 'aiTraining'
    | 'auth'
    | 'storage'
    | string;
  region: ProcessorRegion;
  dpaLink: string;
  sccModule?: string;
  tiaDocId?: string;
};

export type ProcessorValidation = {
  isValid: boolean;
  issues: string[];
};

export function getDefaultProcessors(): ProcessorConfig[] {
  return [
    {
      name: 'Supabase',
      purpose: 'storage',
      region: 'EU',
      dpaLink: 'https://supabase.com/legal/dpa',
      sccModule: 'SCC-2021-914-Module-2',
      tiaDocId: 'TIA-SUP-2024-001',
    },
    {
      name: 'Sentry',
      purpose: 'crashDiagnostics',
      region: 'EU',
      dpaLink: 'https://sentry.io/legal/dpa/',
      sccModule: 'SCC-2021-914-Module-2',
      tiaDocId: 'TIA-SEN-2024-001',
    },
  ];
}

export function validateProcessors(
  list: ProcessorConfig[]
): ProcessorValidation {
  const issues: string[] = [];
  for (const p of list) {
    if (!p.name) issues.push('missing-name');
    if (!p.purpose) issues.push(`missing-purpose:${p.name}`);
    if (!p.dpaLink) issues.push(`missing-dpaLink:${p.name}`);
    if (p.region !== 'EU' && (!p.sccModule || !p.tiaDocId)) {
      issues.push(`missing-scc-tia:${p.name}`);
    }
    if (p.region !== 'EU' && p.region !== 'US' && p.region !== 'Global') {
      issues.push(`invalid-region:${p.name}`);
    }
  }
  return { isValid: issues.length === 0, issues };
}

export function toPublicInventory(list: ProcessorConfig[]): {
  name: string;
  purpose: string;
  region: ProcessorRegion;
  dpaLink: string;
  sccModule?: string;
  tiaDocId?: string;
}[] {
  return list.map((p) => ({
    name: p.name,
    purpose: p.purpose,
    region: p.region,
    dpaLink: p.dpaLink,
    sccModule: p.sccModule,
    tiaDocId: p.tiaDocId,
  }));
}
