/**
 * Monitoring Dashboard Component
 *
 * Real-time monitoring dashboard for moderation system health,
 * performance, and compliance metrics.
 *
 * Requirements: 5.5, 6.6, 10.5
 */

import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import type {
  MonitoringAlert,
  MonitoringDashboard,
} from '@/lib/moderation/monitoring-service';
import { monitoringService } from '@/lib/moderation/monitoring-service';

export function MonitoringDashboardScreen() {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const data = await monitoringService.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load monitoring dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading || !dashboard) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
        <Text className="text-neutral-600 dark:text-neutral-400">
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Health Status */}
        <HealthStatusCard status={dashboard.health_status} />

        {/* Alerts */}
        {dashboard.alerts.length > 0 && (
          <AlertsCard alerts={dashboard.alerts} />
        )}

        {/* Performance Metrics */}
        <PerformanceMetricsCard metrics={dashboard.performance} />

        {/* Error Metrics */}
        <ErrorMetricsCard metrics={dashboard.errors} />

        {/* Audit Integrity */}
        <AuditIntegrityCard metrics={dashboard.audit_integrity} />

        {/* Capacity Metrics */}
        <CapacityMetricsCard metrics={dashboard.capacity} />
      </View>
    </ScrollView>
  );
}

function HealthStatusCard({
  status,
}: {
  status: 'healthy' | 'degraded' | 'critical';
}) {
  const statusColors = {
    healthy: 'bg-success-500',
    degraded: 'bg-warning-500',
    critical: 'bg-danger-500',
  };

  const statusText = {
    healthy: 'System Healthy',
    degraded: 'System Degraded',
    critical: 'Critical Issues',
  };

  return (
    <View className="mb-4 rounded-xl bg-white p-4 dark:bg-charcoal-900">
      <View className="flex-row items-center">
        <View className={`size-4 rounded-full ${statusColors[status]}`} />
        <Text className="ml-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {statusText[status]}
        </Text>
      </View>
    </View>
  );
}

function AlertsCard({ alerts }: { alerts: MonitoringAlert[] }) {
  return (
    <View className="mb-4 rounded-xl bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Active Alerts ({alerts.length})
      </Text>

      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </View>
  );
}

function AlertItem({ alert }: { alert: MonitoringAlert }) {
  const severityColors = {
    info: 'bg-primary-100 dark:bg-primary-900',
    warning: 'bg-warning-100 dark:bg-warning-900',
    error: 'bg-danger-100 dark:bg-danger-900',
    critical: 'bg-danger-200 dark:bg-danger-800',
  };

  const severityTextColors = {
    info: 'text-primary-700 dark:text-primary-300',
    warning: 'text-warning-700 dark:text-warning-300',
    error: 'text-danger-700 dark:text-danger-300',
    critical: 'text-danger-800 dark:text-danger-200',
  };

  return (
    <View
      className={`mb-2 rounded-lg p-3 ${severityColors[alert.severity]}`}
      testID={`alert-${alert.id}`}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-xs font-semibold uppercase ${severityTextColors[alert.severity]}`}
        >
          {alert.severity}
        </Text>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {alert.category}
        </Text>
      </View>

      <Text className="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {alert.message}
      </Text>

      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {alert.metric_name}: {alert.metric_value.toFixed(2)}
        </Text>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          Threshold: {alert.threshold}
        </Text>
      </View>
    </View>
  );
}

function PerformanceMetricsCard({
  metrics,
}: {
  metrics: MonitoringDashboard['performance'];
}) {
  return (
    <View className="mb-4 rounded-xl bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Performance Metrics
      </Text>

      <MetricRow
        label="Report Submission P95"
        value={`${metrics.report_submission_p95.toFixed(0)}ms`}
        testID="metric-report-p95"
      />
      <MetricRow
        label="Decision Processing P95"
        value={`${metrics.moderation_decision_p95.toFixed(0)}ms`}
        testID="metric-decision-p95"
      />
      <MetricRow
        label="Appeal Processing P95"
        value={`${metrics.appeal_processing_p95.toFixed(0)}ms`}
        testID="metric-appeal-p95"
      />

      <View className="my-3 h-px bg-neutral-200 dark:bg-neutral-700" />

      <MetricRow
        label="Reports/min"
        value={metrics.reports_per_minute.toFixed(1)}
        testID="metric-reports-per-min"
      />
      <MetricRow
        label="Decisions/min"
        value={metrics.decisions_per_minute.toFixed(1)}
        testID="metric-decisions-per-min"
      />

      <View className="my-3 h-px bg-neutral-200 dark:bg-neutral-700" />

      <MetricRow
        label="SLA Compliance"
        value={`${metrics.sla_compliance_rate.toFixed(1)}%`}
        highlight={metrics.sla_compliance_rate < 95}
        testID="metric-sla-compliance"
      />
      <MetricRow
        label="Avg SLA Buffer"
        value={`${metrics.average_sla_buffer_hours.toFixed(1)}h`}
        testID="metric-sla-buffer"
      />
    </View>
  );
}

function ErrorMetricsCard({
  metrics,
}: {
  metrics: MonitoringDashboard['errors'];
}) {
  return (
    <View className="mb-4 rounded-xl bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Error Metrics
      </Text>

      <MetricRow
        label="Database Errors"
        value={metrics.database_errors.toString()}
        highlight={metrics.database_errors > 0}
        testID="metric-db-errors"
      />
      <MetricRow
        label="External Service Errors"
        value={metrics.external_service_errors.toString()}
        highlight={metrics.external_service_errors > 0}
        testID="metric-external-errors"
      />
      <MetricRow
        label="DSA Submission Failures"
        value={metrics.dsa_submission_failures.toString()}
        highlight={metrics.dsa_submission_failures > 0}
        testID="metric-dsa-failures"
      />

      <View className="my-3 h-px bg-neutral-200 dark:bg-neutral-700" />

      <MetricRow
        label="Error Rate"
        value={`${metrics.error_rate_percent.toFixed(2)}%`}
        highlight={metrics.error_rate_percent > 5}
        testID="metric-error-rate"
      />
      <MetricRow
        label="Critical Error Rate"
        value={`${metrics.critical_error_rate_percent.toFixed(2)}%`}
        highlight={metrics.critical_error_rate_percent > 1}
        testID="metric-critical-error-rate"
      />
    </View>
  );
}

function AuditIntegrityCard({
  metrics,
}: {
  metrics: MonitoringDashboard['audit_integrity'];
}) {
  return (
    <View className="mb-4 rounded-xl bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Audit Integrity
      </Text>

      <MetricRow
        label="Integrity Score"
        value={`${metrics.integrity_score.toFixed(1)}%`}
        highlight={metrics.integrity_score < 99}
        testID="metric-integrity-score"
      />
      <MetricRow
        label="Events Checked"
        value={metrics.total_events_checked.toString()}
        testID="metric-events-checked"
      />
      <MetricRow
        label="Integrity Violations"
        value={metrics.integrity_violations.toString()}
        highlight={metrics.integrity_violations > 0}
        testID="metric-integrity-violations"
      />
      <MetricRow
        label="Signature Mismatches"
        value={metrics.signature_mismatches.toString()}
        highlight={metrics.signature_mismatches > 0}
        testID="metric-signature-mismatches"
      />

      <View className="my-3 h-px bg-neutral-200 dark:bg-neutral-700" />

      <MetricRow
        label="Partitions Checked"
        value={metrics.partitions_checked.toString()}
        testID="metric-partitions-checked"
      />
      <MetricRow
        label="Corrupted Partitions"
        value={metrics.corrupted_partitions.toString()}
        highlight={metrics.corrupted_partitions > 0}
        testID="metric-corrupted-partitions"
      />
    </View>
  );
}

function CapacityMetricsCard({
  metrics,
}: {
  metrics: MonitoringDashboard['capacity'];
}) {
  return (
    <View className="mb-4 rounded-xl bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Capacity Metrics
      </Text>

      <MetricRow
        label="Pending Reports"
        value={metrics.pending_reports.toString()}
        testID="metric-pending-reports"
      />
      <MetricRow
        label="Pending Appeals"
        value={metrics.pending_appeals.toString()}
        testID="metric-pending-appeals"
      />
      <MetricRow
        label="Pending SoR Exports"
        value={metrics.pending_sor_exports.toString()}
        testID="metric-pending-sor"
      />

      <View className="my-3 h-px bg-neutral-200 dark:bg-neutral-700" />

      <MetricRow
        label="Queue Growth Rate"
        value={`${metrics.queue_growth_rate.toFixed(0)}/hr`}
        testID="metric-queue-growth"
      />
      <MetricRow
        label="Moderator Utilization"
        value={`${metrics.moderator_utilization.toFixed(1)}%`}
        highlight={metrics.moderator_utilization > 90}
        testID="metric-moderator-util"
      />
      <MetricRow
        label="Estimated Capacity"
        value={`${metrics.estimated_capacity_hours.toFixed(1)}h`}
        highlight={metrics.estimated_capacity_hours < 24}
        testID="metric-capacity-hours"
      />
    </View>
  );
}

function MetricRow({
  label,
  value,
  highlight = false,
  testID,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  testID?: string;
}) {
  return (
    <View
      className="mb-2 flex-row items-center justify-between"
      testID={testID}
    >
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {label}
      </Text>
      <Text
        className={`text-sm font-medium ${
          highlight
            ? 'text-danger-600 dark:text-danger-400'
            : 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
