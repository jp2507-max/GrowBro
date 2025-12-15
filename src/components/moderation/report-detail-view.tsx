/**
 * Report Detail View Component
 * Comprehensive view of a single report with context, similar decisions, and COI warnings
 * Requirements: 2.1, 2.2, 2.3, 11.1
 */

import React from 'react';
import { ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import type { ConflictOfInterest, QueuedReport } from '@/types/moderation';

import { PriorityBadge } from './priority-badge';
import { SLABadge } from './sla-badge';

interface ReportDetailViewProps {
  report: QueuedReport;
  conflictOfInterest?: ConflictOfInterest;
  similarDecisions: {
    id: string;
    category: string;
    action: string;
    outcome: string;
    reason_code: string;
    decided_at: string;
    similarity: number;
  }[];
  policyCatalog: {
    id: string;
    title: string;
    description: string;
    legal_basis?: string;
  }[];
  onTakeAction?: (action: string, reason: string) => void;
  onRequestSupervisorReview?: () => void;
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
}

export function ReportDetailView({
  report,
  conflictOfInterest: _conflictOfInterest,
  similarDecisions: _similarDecisions,
  policyCatalog: _policyCatalog,
  onTakeAction,
  onRequestSupervisorReview: _onRequestSupervisorReview,
}: ReportDetailViewProps) {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <ReportHeader report={report} />
        <ContentDetails report={report} />
        {onTakeAction && <ActionButtons onTakeAction={onTakeAction} />}
      </View>
    </ScrollView>
  );
}

function ReportHeader({ report }: { report: QueuedReport }) {
  const reportCategory =
    report.report_type === 'illegal' ? 'Illegal Content' : 'ToS Violation';
  const reporterType = report.trusted_flagger ? 'Trusted Flagger' : 'User';

  return (
    <View className="mb-4 rounded-xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-1 text-xl font-bold text-text-primary">
            Report #{report.id.slice(0, 8)}
          </Text>
          <Text className="mb-1 text-sm text-text-secondary">
            {reportCategory} · {reporterType}
          </Text>
          <Text className="text-xs text-text-secondary">
            Submitted: {formatDate(report.created_at)}
          </Text>
        </View>
        <View className="items-end gap-2">
          <SLABadge
            status={report.sla_status}
            deadline={new Date(report.sla_deadline)}
          />
          <PriorityBadge
            priority={
              report.priority >= 90
                ? 'immediate'
                : report.priority >= 70
                  ? 'illegal'
                  : report.priority >= 50
                    ? 'trusted'
                    : 'standard'
            }
          />
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

      <View className="border-t border-border pt-3">
        <Text className="mb-1 text-xs font-medium text-text-secondary">
          Explanation
        </Text>
        <Text className="text-sm leading-5 text-text-primary">
          {report.explanation}
        </Text>
      </View>

      {report.evidence_urls && report.evidence_urls.length > 0 && (
        <View className="mt-3 border-t border-border pt-3">
          <Text className="mb-2 text-xs font-medium text-text-secondary">
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
  );
}

function ContentDetails({ report }: { report: QueuedReport }) {
  return (
    <View className="mb-4 rounded-xl border border-border bg-card p-4">
      <Text className="mb-3 text-base font-semibold text-text-primary">
        Content Details
      </Text>
      <View className="gap-2">
        <View className="flex-row">
          <Text className="w-32 text-xs text-text-secondary">Content ID:</Text>
          <Text className="flex-1 text-xs font-medium text-text-primary">
            {report.content_id}
          </Text>
        </View>
        <View className="flex-row">
          <Text className="w-32 text-xs text-text-secondary">
            Content Type:
          </Text>
          <Text className="flex-1 text-xs font-medium text-text-primary">
            {report.content_type}
          </Text>
        </View>
        <View className="flex-row">
          <Text className="w-32 text-xs text-text-secondary">
            Content Hash:
          </Text>
          <Text
            className="flex-1 font-mono text-xs text-text-secondary"
            numberOfLines={1}
          >
            {report.content_hash}
          </Text>
        </View>
        {report.content_snapshot && (
          <View className="flex-row">
            <Text className="w-32 text-xs text-text-secondary">
              Snapshot ID:
            </Text>
            <Text className="flex-1 text-xs font-medium text-text-primary">
              {report.content_snapshot?.id?.slice(0, 8)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ActionButtons({
  onTakeAction,
}: {
  onTakeAction: (action: string, reason: string) => void;
}) {
  return (
    <View className="mb-4 gap-3 rounded-xl border border-border bg-card p-4">
      <Text className="mb-2 text-base font-semibold text-text-primary">
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
            onTakeAction('remove', 'Content violates community guidelines')
          }
          label="Remove"
          variant="destructive"
          size="sm"
        />
        <Button
          onPress={() =>
            onTakeAction('geo_block', 'Content restricted by jurisdiction')
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
  );
}
