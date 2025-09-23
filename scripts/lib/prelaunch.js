// Lightweight Pre-launch report validator used by CI and unit tests
// Expected input shape (loosely typed):
// {
//   warnings: [ { id, type, message, severity } ],
//   policy: { warnings: number, errors: number },
//   security: { warnings: number, errors: number },
//   crawled: boolean,
//   deviceMatrix: { android13: boolean, android14: boolean, android15: boolean }
// }
// We intentionally accept partial shapes and coerce missing fields to safe defaults.

function coerceNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function summarizeWarnings(report) {
  const policy =
    coerceNumber(report?.policy?.warnings) +
    coerceNumber(report?.policy?.errors);
  const security =
    coerceNumber(report?.security?.warnings) +
    coerceNumber(report?.security?.errors);
  const list = Array.isArray(report?.warnings) ? report.warnings : [];
  return {
    policyTotal: policy,
    securityTotal: security,
    list,
  };
}

function validatePrelaunchReport(report, opts = {}) {
  const {
    requireCrawler = true,
    requireDeviceMatrix = ['android13', 'android14', 'android15'],
  } = opts;
  const warnings = summarizeWarnings(report);
  const problems = [];

  if (warnings.policyTotal > 0) {
    problems.push({
      ruleId: 'prelaunch:policy-warnings',
      count: warnings.policyTotal,
    });
  }
  if (warnings.securityTotal > 0) {
    problems.push({
      ruleId: 'prelaunch:security-warnings',
      count: warnings.securityTotal,
    });
  }
  if (requireCrawler && report?.crawled !== true) {
    problems.push({ ruleId: 'prelaunch:crawler-failed' });
  }
  const dm = report?.deviceMatrix || {};
  for (const key of requireDeviceMatrix) {
    if (!dm[key])
      problems.push({ ruleId: 'prelaunch:device-matrix-missing', key });
  }

  return { ok: problems.length === 0, problems, warnings };
}

module.exports = {
  summarizeWarnings,
  validatePrelaunchReport,
};
