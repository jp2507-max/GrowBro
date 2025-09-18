export type ProcessorConfig = {
  processor: string;
  region: 'EU' | 'US' | 'Global';
  dpaUrl: string;
  sccModule?: string;
  tiaDocId?: string;
};

export function validateProcessors(configs: ProcessorConfig[]): void {
  for (const cfg of configs) {
    if (cfg.region !== 'EU') {
      if (!cfg.sccModule || !cfg.tiaDocId) {
        throw new Error(
          `Non-EU processor ${cfg.processor} missing SCC/TIA (region=${cfg.region})`
        );
      }
    }
    if (!cfg.dpaUrl) {
      throw new Error(`Processor ${cfg.processor} missing DPA link`);
    }
  }
}
