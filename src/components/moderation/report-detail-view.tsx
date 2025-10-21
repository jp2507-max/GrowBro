/**
 * Report Detail View Component
 * Comprehensive view of a single report with context, similar decisions, and COI warnings
 * Requirements: 2.1, 2.2, 2.3, 11.1
 */

import React from 'react';
import { ScrollView } from 'react-native';

import { Button, Pressable, Text, View } from '@/components/ui';
import type {
  ConflictOfInterest,
  ModerationAction,
  PolicyCatalogEntry,
  PriorDecision,
  QueuedReport,
} from '@/types/moderation';

import { PriorityBadge } from './priority-badge';
import { SLABadge } from './sla-badge';

type Props = {
  report: QueuedReport;
  similarDecisions: PriorDecision[];
  policyCatalog: PolicyCatalogEntry[];
  conflictOfInterest?: ConflictOfInterest;
  onTakeAction?: (
    action: ModerationAction,
    reasoning: string,
    evidence?: string[]
  ) => void;
  onRequestSupervisorReview?: () => void;
  testID?: string;
};

export function ReportDetailView({
  report,
  similarDecisions,
  policyCatalog,
  conflictOfInterest,
  onTakeAction,
  onRequestSupervisorReview,
  testID = 'report-detail',
}: Props) {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: ModerationAction): string => {
    switch (action) {
      case 'no_action':
        return 'text-neutral-600 dark:text-neutral-400';
      case 'quarantine':
      case 'rate_limit':
        return 'text-warning-600 dark:text-warning-400';
      case 'geo_block':
      case 'shadow_ban':
        return 'text-primary-600 dark:text-primary-400';
      case 'remove':
      case 'suspend_user':
        return 'text-danger-600 dark:text-danger-400';
      default:
        return 'text-neutral-600 dark:text-neutral-400';
    }
  };

  const reportCategory =
    report.report_type === 'illegal' ? 'Illegal Content' : 'ToS Violation';
  const reporterType = report.trusted_flagger ? 'Trusted Flagger' : 'User';

  return (
    <ScrollView
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID={testID}
    >
      <View className="p-4">
        {/* COI Warning Banner */}
        {conflictOfInterest?.has_conflict && (
          <View className="mb-4 rounded-lg border-2 border-danger-500 bg-danger-100 p-4 dark:bg-danger-900/20">
            <Text className="mb-2 text-base font-bold text-danger-800 dark:text-danger-200">
              ⚠ Conflict of Interest Detected
            </Text>
            {conflictOfInterest.reasons.map((reason, idx) => (
              <Text
                key={idx}
                className="mb-1 text-sm text-danger-700 dark:text-danger-300"
              >
                • {reason}
              </Text>
            ))}
            {conflictOfInterest.conflict_type && (
              <Text className="mt-2 text-xs text-danger-600 dark:text-danger-400">
                Type: {conflictOfInterest.conflict_type}
              </Text>
            )}
            {onRequestSupervisorReview && (
              <Button
                onPress={onRequestSupervisorReview}
                label="Request Supervisor Review"
                variant="destructive"
                size="sm"
                className="mt-3"
              />
            )}
          </View>
        )}

        {/* Report Header */}
        <View className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="mb-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Report #{report.id.slice(0, 8)}
              </Text>
              <Text className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">
                {reportCategory} · {reporterType}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-500">
                Submitted: {formatDate(report.created_at)}
              </Text>
            </View>
            <View className="items-end gap-2">
              <SLABadge
                status={report.sla_status}
                deadline={new Date(report.sla_deadline)}
              />
              <PriorityBadge priority={report.priority.toString()} />
            </View>
          </View>

          {report.jurisdiction && (
            <View className="mb-3 rounded-md bg-primary-50 p-2 dark:bg-primary-900/10">
              <Text className="text-xs text-primary-700 dark:text-primary-300">
                Jurisdiction: {report.jurisdiction}
              </Text>
              {report.legal_reference && (
                <Text className="text-xs text-primary-700 dark:text-primary-300">
                  Legal Reference: {report.legal_reference}
                </Text>
              )}
            </View>
          )}

          <View className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
            <Text className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Explanation
            </Text>
            <Text className="text-sm leading-5 text-neutral-900 dark:text-neutral-100">
              {report.explanation}
            </Text>
          </View>

          {report.evidence_urls && report.evidence_urls.length > 0 && (
            <View className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <Text className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Evidence ({report.evidence_urls.length})
              </Text>
              {report.evidence_urls.map((url, idx) => (
                <Text
                  key={idx}
                  className="mb-1 text-xs text-primary-600 dark:text-primary-400"
                  numberOfLines={1}
                >
                  {url}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Content Details */}
        <View className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
          <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Content Details
          </Text>
          <View className="gap-2">
            <View className="flex-row">
              <Text className="w-32 text-xs text-neutral-600 dark:text-neutral-400">
                Content ID:
              </Text>
              <Text className="flex-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">
                {report.content_id}
              </Text>
            </View>
            <View className="flex-row">
              <Text className="w-32 text-xs text-neutral-600 dark:text-neutral-400">
                Content Type:
              </Text>
              <Text className="flex-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">
                {report.content_type}
              </Text>
            </View>
            <View className="flex-row">
              <Text className="w-32 text-xs text-neutral-600 dark:text-neutral-400">
                Content Hash:
              </Text>
              <Text
                className="flex-1 font-mono text-xs text-neutral-700 dark:text-neutral-300"
                numberOfLines={1}
              >
                {report.content_hash}
              </Text>
            </View>
            {report.content_snapshot && (
              <View className="flex-row">
                <Text className="w-32 text-xs text-neutral-600 dark:text-neutral-400">
                  Snapshot ID:
                </Text>
                <Text className="flex-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  {report.content_snapshot_id?.slice(0, 8)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Policy Catalog Links */}
        {policyCatalog.length > 0 && (
          <View className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
            <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Relevant Policies ({policyCatalog.length})
            </Text>
            <View className="gap-3">
              {policyCatalog.map((policy) => (
                <Pressable
                  key={policy.id}
                  accessibilityRole="button"
                  accessibilityLabel={policy.title}
                  accessibilityHint="View policy details"
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-charcoal-900"
                >
                  <Text className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {policy.title}
                  </Text>
                  <Text className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {policy.description}
                  </Text>
                  {policy.legal_basis && (
                    <Text className="text-xs text-primary-600 dark:text-primary-400">
                      Legal Basis: {policy.legal_basis}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Similar Decisions */}
        {similarDecisions.length > 0 && (
          <View className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
            <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Similar Decisions ({similarDecisions.length})
            </Text>
            <View className="gap-3">
              {similarDecisions.map((decision) => (
                <View
                  key={decision.id}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-charcoal-900"
                >
                  <View className="mb-2 flex-row items-start justify-between">
                    <Text className="flex-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {decision.category}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-500">
                      {Math.round(decision.similarity * 100)}% match
                    </Text>
                  </View>
                  <View className="mb-2 flex-row items-center gap-2">
                    <Text
                      className={`text-sm font-semibold ${getActionColor(decision.action)}`}
                    >
                      {decision.action.replace('_', ' ').toUpperCase()}
                    </Text>
                    <View
                      className={`rounded px-2 py-1 ${
                        decision.outcome === 'upheld'
                          ? 'bg-success-100 dark:bg-success-900/20'
                          : decision.outcome === 'reversed'
                            ? 'bg-danger-100 dark:bg-danger-900/20'
                            : 'bg-warning-100 dark:bg-warning-900/20'
                      }`}
                    >
                      <Text className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        {decision.outcome}
                      </Text>
                    </View>
                  </View>
                  <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Reason: {decision.reason_code}
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-500">
                    Decided: {formatDate(decision.decided_at)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {onTakeAction && (
          <View className="mb-4 gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-charcoal-800">
            <Text className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Take Action
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                onPress={() => onTakeAction('no_action', 'No violation found')}
                label="No Action"
                variant="outline"
                size="sm"
              />
              <Button
                onPress={() =>
                  onTakeAction('quarantine', 'Content quarantined for review')
                }
                label="Quarantine"
                variant="outline"
                size="sm"
              />
              <Button
                onPress={() =>
                  onTakeAction(
                    'remove',
                    'Content violates community guidelines'
                  )
                }
                label="Remove"
                variant="destructive"
                size="sm"
              />
              <Button
                onPress={() =>
                  onTakeAction(
                    'geo_block',
                    'Content restricted by jurisdiction'
                  )
                }
                label="Geo-Block"
                variant="outline"
                size="sm"
              />
              <Button
                onPress={() =>
                  onTakeAction('suspend_user', 'User suspended for violations')
                }
                label="Suspend User"
                variant="destructive"
                size="sm"
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
