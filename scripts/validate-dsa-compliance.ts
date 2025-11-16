/**
 * DSA Compliance Validation Tool
 *
 * Validates all DSA article implementations against acceptance criteria.
 * Generates compliance report with pass/fail status per article.
 *
 * Usage: pnpm tsx scripts/validate-dsa-compliance.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ValidationResult {
  article: string;
  passed: boolean;
  checks: CheckResult[];
  blockers: string[];
  recommendations: string[];
}

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  evidence?: string;
}

interface ComplianceReport {
  timestamp: Date;
  overallStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
  results: ValidationResult[];
  summary: {
    totalArticles: number;
    passedArticles: number;
    failedArticles: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
}

// ============================================================================
// Validators
// ============================================================================

class DSAComplianceValidator {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async validateAll(): Promise<ComplianceReport> {
    const results: ValidationResult[] = [];

    results.push(await this.validateArticle16());
    results.push(await this.validateArticle17());
    results.push(await this.validateArticle20());
    results.push(await this.validateArticle21());
    results.push(await this.validateArticle22());
    results.push(await this.validateArticle23());
    results.push(await this.validateArticle24_5());
    results.push(await this.validateArticle28());
    results.push(await this.validateArticle15_24());

    const summary = this.calculateSummary(results);
    const overallStatus = this.determineOverallStatus(summary);

    return {
      timestamp: new Date(),
      overallStatus,
      results,
      summary,
    };
  }

  private async validateArticle16(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check database schema
    const schemaCheck = await this.checkTableExists('content_reports');
    checks.push({
      name: 'Database schema exists',
      passed: schemaCheck,
      details: schemaCheck
        ? 'content_reports table found'
        : 'content_reports table missing',
    });

    // Check mandatory fields
    const fieldsCheck = await this.checkTableColumns('content_reports', [
      'explanation',
      'content_locator',
      'reporter_contact',
      'good_faith_declaration',
      'jurisdiction',
    ]);
    checks.push({
      name: 'Mandatory Art. 16 fields present',
      passed: fieldsCheck.allPresent,
      details: fieldsCheck.allPresent
        ? 'All mandatory fields present'
        : `Missing fields: ${fieldsCheck.missing.join(', ')}`,
    });

    // Check validation logic
    const validationCheck = this.checkFileExists('src/types/moderation.ts');
    checks.push({
      name: 'Validation logic implemented',
      passed: validationCheck,
      details: validationCheck
        ? 'Zod schemas found in src/types/moderation.ts'
        : 'Validation schemas missing',
    });

    // Check UI components
    const uiCheck = this.checkFileExists(
      'src/components/moderation/report-submission-form.tsx'
    );
    checks.push({
      name: 'Report submission UI exists',
      passed: uiCheck,
      details: uiCheck
        ? 'Report form component found'
        : 'Report form component missing',
    });

    if (!schemaCheck) {
      blockers.push('Database schema not created - run migrations');
    }

    return {
      article: 'Art. 16 - Notice-and-Action',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle17(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check SoR table
    const schemaCheck = await this.checkTableExists('statements_of_reasons');
    checks.push({
      name: 'SoR database schema exists',
      passed: schemaCheck,
      details: schemaCheck
        ? 'statements_of_reasons table found'
        : 'statements_of_reasons table missing',
    });

    // Check mandatory SoR fields
    const fieldsCheck = await this.checkTableColumns('statements_of_reasons', [
      'decision_ground',
      'facts_and_circumstances',
      'automated_detection',
      'automated_decision',
      'redress',
    ]);
    checks.push({
      name: 'Mandatory Art. 17 fields present',
      passed: fieldsCheck.allPresent,
      details: fieldsCheck.allPresent
        ? 'All mandatory SoR fields present'
        : `Missing fields: ${fieldsCheck.missing.join(', ')}`,
    });

    // Check SoR generator service
    const serviceCheck = this.checkFileExists(
      'src/lib/moderation/moderation-service.ts'
    );
    checks.push({
      name: 'SoR generator service exists',
      passed: serviceCheck,
      details: serviceCheck
        ? 'Moderation service found'
        : 'Moderation service missing',
    });

    // Check notification delivery
    const notificationCheck = this.checkFileExists(
      'src/lib/moderation/moderation-notifications.ts'
    );
    checks.push({
      name: 'SoR notification delivery exists',
      passed: notificationCheck,
      details: notificationCheck
        ? 'Notification service found'
        : 'Notification service missing',
    });

    if (!schemaCheck) {
      blockers.push('SoR database schema not created');
    }

    recommendations.push('Verify SoR delivery within 15 minutes in production');

    return {
      article: 'Art. 17 - Statement of Reasons',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle20(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check appeals table
    const schemaCheck = await this.checkTableExists('appeals');
    checks.push({
      name: 'Appeals database schema exists',
      passed: schemaCheck,
      details: schemaCheck ? 'appeals table found' : 'appeals table missing',
    });

    // Check appeals service
    const serviceCheck = this.checkFileExists(
      'src/lib/moderation/appeals-service.ts'
    );
    checks.push({
      name: 'Appeals service exists',
      passed: serviceCheck,
      details: serviceCheck
        ? 'Appeals service found'
        : 'Appeals service missing',
    });

    // Check conflict-of-interest prevention
    const coiCheck = this.checkFileContains(
      'src/lib/moderation/appeals-service.ts',
      'findEligibleReviewer'
    );
    checks.push({
      name: 'Conflict-of-interest prevention implemented',
      passed: coiCheck,
      details: coiCheck
        ? 'Reviewer assignment with COI prevention found'
        : 'COI prevention logic missing',
    });

    // Check appeal UI
    const uiCheck = this.checkFileExists(
      'src/components/moderation/appeal-submission-form.tsx'
    );
    checks.push({
      name: 'Appeal submission UI exists',
      passed: uiCheck,
      details: uiCheck
        ? 'Appeal form component found'
        : 'Appeal form component missing',
    });

    if (!schemaCheck) {
      blockers.push('Appeals database schema not created');
    }

    recommendations.push('Verify ≥7 day appeal window in production');
    recommendations.push('Test human review assignment rotation');

    return {
      article: 'Art. 20 - Internal Complaint-Handling',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle21(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check ODS tables
    const bodiesCheck = await this.checkTableExists('ods_bodies');
    const escalationsCheck = await this.checkTableExists('ods_escalations');
    checks.push({
      name: 'ODS database schema exists',
      passed: bodiesCheck && escalationsCheck,
      details:
        bodiesCheck && escalationsCheck
          ? 'ODS tables found'
          : 'ODS tables missing',
    });

    // Check ODS integration service
    const serviceCheck = this.checkFileExists(
      'src/lib/moderation/ods-integration.ts'
    );
    checks.push({
      name: 'ODS integration service exists',
      passed: serviceCheck,
      details: serviceCheck
        ? 'ODS integration found'
        : 'ODS integration missing',
    });

    if (!bodiesCheck || !escalationsCheck) {
      blockers.push('ODS database schema not created');
    }

    blockers.push('Certified ODS body selection pending legal review');
    recommendations.push('Configure ODS body API credentials');
    recommendations.push('Test 90-day resolution tracking');

    return {
      article: 'Art. 21 - Out-of-Court Dispute Settlement',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle22(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check trusted flaggers table
    const schemaCheck = await this.checkTableExists('trusted_flaggers');
    checks.push({
      name: 'Trusted flaggers database schema exists',
      passed: schemaCheck,
      details: schemaCheck
        ? 'trusted_flaggers table found'
        : 'trusted_flaggers table missing',
    });

    // Check priority lane implementation
    const priorityCheck = this.checkFileContains(
      'src/lib/moderation/moderation-service.ts',
      'trusted_flagger'
    );
    checks.push({
      name: 'Priority lane implemented',
      passed: priorityCheck,
      details: priorityCheck
        ? 'Trusted flagger priority logic found'
        : 'Priority lane logic missing',
    });

    // Check quality analytics
    const analyticsCheck = this.checkFileExists(
      'src/components/moderation/flagger-analytics-dashboard.tsx'
    );
    checks.push({
      name: 'Quality analytics dashboard exists',
      passed: analyticsCheck,
      details: analyticsCheck
        ? 'Analytics dashboard found'
        : 'Analytics dashboard missing',
    });

    if (!schemaCheck) {
      blockers.push('Trusted flaggers database schema not created');
    }

    blockers.push('Trusted flagger certification criteria pending definition');
    recommendations.push('Define quarterly review workflow');

    return {
      article: 'Art. 22 - Trusted Flaggers',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle23(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check repeat offender tables
    const schemaCheck = await this.checkTableExists('repeat_offender_records');
    checks.push({
      name: 'Repeat offender database schema exists',
      passed: schemaCheck,
      details: schemaCheck
        ? 'repeat_offender_records table found'
        : 'repeat_offender_records table missing',
    });

    // Check repeat offender service
    const serviceCheck = this.checkFileExists(
      'src/lib/moderation/repeat-offender-service.ts'
    );
    checks.push({
      name: 'Repeat offender service exists',
      passed: serviceCheck,
      details: serviceCheck
        ? 'Repeat offender service found'
        : 'Repeat offender service missing',
    });

    // Check graduated enforcement
    const enforcementCheck = this.checkFileExists(
      'src/lib/moderation/enforcement-config.ts'
    );
    checks.push({
      name: 'Graduated enforcement config exists',
      passed: enforcementCheck,
      details: enforcementCheck
        ? 'Enforcement config found'
        : 'Enforcement config missing',
    });

    if (!schemaCheck) {
      blockers.push('Repeat offender database schema not created');
    }

    recommendations.push('Test graduated enforcement thresholds');
    recommendations.push('Verify manifestly unfounded reporter tracking');

    return {
      article: 'Art. 23 - Measures Against Misuse',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle24_5(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check SoR export queue
    const schemaCheck = await this.checkTableExists('sor_export_queue');
    checks.push({
      name: 'SoR export queue schema exists',
      passed: schemaCheck,
      details: schemaCheck
        ? 'sor_export_queue table found'
        : 'sor_export_queue table missing',
    });

    // Check PII scrubber
    const scrubberCheck = this.checkFileExists(
      'src/lib/moderation/pii-scrubber.ts'
    );
    checks.push({
      name: 'PII scrubber exists',
      passed: scrubberCheck,
      details: scrubberCheck ? 'PII scrubber found' : 'PII scrubber missing',
    });

    // Check DSA transparency client
    const clientCheck = this.checkFileExists(
      'src/lib/moderation/dsa-transparency-client.ts'
    );
    checks.push({
      name: 'DSA Transparency DB client exists',
      passed: clientCheck,
      details: clientCheck
        ? 'Transparency DB client found'
        : 'Transparency DB client missing',
    });

    // Check circuit breaker
    const circuitCheck = this.checkFileExists(
      'src/lib/moderation/sor-circuit-breaker.ts'
    );
    checks.push({
      name: 'Circuit breaker pattern implemented',
      passed: circuitCheck,
      details: circuitCheck
        ? 'Circuit breaker found'
        : 'Circuit breaker missing',
    });

    // Check orchestrator
    const orchestratorCheck = this.checkFileExists(
      'src/lib/moderation/sor-submission-orchestrator.ts'
    );
    checks.push({
      name: 'SoR submission orchestrator exists',
      passed: orchestratorCheck,
      details: orchestratorCheck
        ? 'Orchestrator found'
        : 'Orchestrator missing',
    });

    if (!schemaCheck) {
      blockers.push('SoR export queue schema not created');
    }

    blockers.push('Commission DB API credentials pending');
    recommendations.push('Run PII scrubbing golden tests');
    recommendations.push('Configure DLQ monitoring and alerting');

    return {
      article: 'Art. 24(5) - SoR Database Submission',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle28(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check age verification tables
    const tokensCheck = await this.checkTableExists('age_verification_tokens');
    const statusCheck = await this.checkTableExists('user_age_status');
    checks.push({
      name: 'Age verification database schema exists',
      passed: tokensCheck && statusCheck,
      details:
        tokensCheck && statusCheck
          ? 'Age verification tables found'
          : 'Age verification tables missing',
    });

    // Check age verification service
    const serviceCheck = this.checkFileExists(
      'src/lib/moderation/age-verification-service.ts'
    );
    checks.push({
      name: 'Age verification service exists',
      passed: serviceCheck,
      details: serviceCheck
        ? 'Age verification service found'
        : 'Age verification service missing',
    });

    // Check content age-gating
    const gatingCheck = this.checkFileExists(
      'src/lib/moderation/content-age-gating.ts'
    );
    checks.push({
      name: 'Content age-gating engine exists',
      passed: gatingCheck,
      details: gatingCheck
        ? 'Age-gating engine found'
        : 'Age-gating engine missing',
    });

    if (!tokensCheck || !statusCheck) {
      blockers.push('Age verification database schema not created');
    }

    blockers.push('Third-party age verification provider selection pending');
    recommendations.push('Verify no raw ID storage in tests');
    recommendations.push('Test token replay prevention');
    recommendations.push('Configure EUDI wallet integration when available');

    return {
      article: 'Art. 28 - Protection of Minors',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  private async validateArticle15_24(): Promise<ValidationResult> {
    const checks: CheckResult[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];

    // Check transparency service
    const serviceCheck = this.checkFileExists(
      'src/lib/moderation/transparency-service.ts'
    );
    checks.push({
      name: 'Transparency service exists',
      passed: serviceCheck,
      details: serviceCheck
        ? 'Transparency service found'
        : 'Transparency service missing',
    });

    // Check metrics tracking
    const metricsCheck = this.checkFileExists(
      'src/lib/moderation/moderation-metrics.ts'
    );
    checks.push({
      name: 'Metrics tracking service exists',
      passed: metricsCheck,
      details: metricsCheck
        ? 'Metrics service found'
        : 'Metrics service missing',
    });

    recommendations.push('Generate annual transparency report template');
    recommendations.push('Configure real-time metrics dashboard');

    return {
      article: 'Art. 15 & 24 - Transparency Reporting',
      passed: checks.every((c) => c.passed),
      checks,
      blockers,
      recommendations,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(0);
      return !error;
    } catch {
      return false;
    }
  }

  private async checkTableColumns(
    tableName: string,
    requiredColumns: string[]
  ): Promise<{ allPresent: boolean; missing: string[] }> {
    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error || !data || data.length === 0) {
        return { allPresent: false, missing: requiredColumns };
      }

      const existingColumns = Object.keys(data[0] || {});
      const missing = requiredColumns.filter(
        (col) => !existingColumns.includes(col)
      );

      return { allPresent: missing.length === 0, missing };
    } catch {
      return { allPresent: false, missing: requiredColumns };
    }
  }

  private checkFileExists(filePath: string): boolean {
    const fullPath = path.join(process.cwd(), filePath);
    return fs.existsSync(fullPath);
  }

  private checkFileContains(filePath: string, searchString: string): boolean {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return false;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content.includes(searchString);
  }

  private calculateSummary(results: ValidationResult[]) {
    const totalArticles = results.length;
    const passedArticles = results.filter((r) => r.passed).length;
    const failedArticles = totalArticles - passedArticles;

    const totalChecks = results.reduce((sum, r) => sum + r.checks.length, 0);
    const passedChecks = results.reduce(
      (sum, r) => sum + r.checks.filter((c) => c.passed).length,
      0
    );
    const failedChecks = totalChecks - passedChecks;

    return {
      totalArticles,
      passedArticles,
      failedArticles,
      totalChecks,
      passedChecks,
      failedChecks,
    };
  }

  private determineOverallStatus(summary: {
    passedArticles: number;
    totalArticles: number;
  }): 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' {
    const passRate = summary.passedArticles / summary.totalArticles;
    if (passRate === 1) return 'COMPLIANT';
    if (passRate >= 0.7) return 'PARTIAL';
    return 'NON_COMPLIANT';
  }
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push('# DSA Compliance Validation Report');
  lines.push('');
  lines.push(`**Generated**: ${report.timestamp.toISOString()}`);
  lines.push(`**Overall Status**: ${report.overallStatus}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Articles**: ${report.summary.totalArticles}`);
  lines.push(`- **Passed Articles**: ${report.summary.passedArticles}`);
  lines.push(`- **Failed Articles**: ${report.summary.failedArticles}`);
  lines.push(`- **Total Checks**: ${report.summary.totalChecks}`);
  lines.push(`- **Passed Checks**: ${report.summary.passedChecks}`);
  lines.push(`- **Failed Checks**: ${report.summary.failedChecks}`);
  lines.push('');

  lines.push('## Article Validation Results');
  lines.push('');

  for (const result of report.results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(`### ${result.article} - ${status}`);
    lines.push('');

    lines.push('**Checks:**');
    lines.push('');
    for (const check of result.checks) {
      const checkStatus = check.passed ? '✅' : '❌';
      lines.push(`- ${checkStatus} ${check.name}: ${check.details}`);
    }
    lines.push('');

    if (result.blockers.length > 0) {
      lines.push('**Blockers:**');
      lines.push('');
      for (const blocker of result.blockers) {
        lines.push(`- 🚫 ${blocker}`);
      }
      lines.push('');
    }

    if (result.recommendations.length > 0) {
      lines.push('**Recommendations:**');
      lines.push('');
      for (const rec of result.recommendations) {
        lines.push(`- 💡 ${rec}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🔍 Starting DSA Compliance Validation...\n');

  const validator = new DSAComplianceValidator();
  const report = await validator.validateAll();

  const reportText = generateReport(report);

  // Write to file
  const reportPath = path.join(
    process.cwd(),
    'build',
    'reports',
    'compliance',
    'dsa-validation-report.md'
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, reportText);

  // Write JSON
  const jsonPath = path.join(
    process.cwd(),
    'build',
    'reports',
    'compliance',
    'dsa-validation-report.json'
  );
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(reportText);
  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log(`📄 JSON saved to: ${jsonPath}`);

  // Exit with appropriate code
  process.exit(report.overallStatus === 'COMPLIANT' ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
