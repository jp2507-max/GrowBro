// ROPA (Article 30) extraction from code annotations

export type ROPARecord = {
  purpose: string;
  lawfulBasis: string;
  dataCategories: string[];
  recipients: string[];
  retention: string;
};

/**
 * Parse JSDoc-style annotations from a given code string into a ROPARecord.
 * Expected annotations (all required):
 *  @ropa-purpose telemetry
 *  @ropa-lawful-basis consent-6.1.a
 *  @ropa-data-categories device-info,usage-patterns
 *  @ropa-recipients supabase-eu,internal-analytics
 *  @ropa-retention 90-days
 */
export function parseROPAAnnotations(code: string): ROPARecord | null {
  const get = (re: RegExp): string | null => {
    const m = code.match(re);
    return m && m[1] ? m[1].trim() : null;
  };

  const purpose = get(/@ropa-purpose\s+([^\n*]+)/);
  const lawfulBasis = get(/@ropa-lawful-basis\s+([^\n*]+)/);
  const dataCats = get(/@ropa-data-categories\s+([^\n*]+)/);
  const recipients = get(/@ropa-recipients\s+([^\n*]+)/);
  const retention = get(/@ropa-retention\s+([^\n*]+)/);

  if (!purpose || !lawfulBasis || !dataCats || !recipients || !retention) {
    return null;
  }
  return {
    purpose,
    lawfulBasis,
    dataCategories: dataCats
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    recipients: recipients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    retention,
  };
}

export type ROPAExport = {
  records: ROPARecord[];
};

export function emitROPAJson(records: ROPARecord[]): string {
  return JSON.stringify({ records }, null, 2);
}
