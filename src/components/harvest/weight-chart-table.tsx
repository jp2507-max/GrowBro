/**
 * Weight Chart Table Fallback
 *
 * Tabular view shown when chart rendering fails
 * Requirement: 4.6 (fallback view)
 */

import { FlashList } from '@shopify/flash-list';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { formatWeight } from '@/lib/harvest/weight-conversion';
import type { ChartDataPoint, HarvestStage } from '@/types/harvest';

type Props = {
  data: ChartDataPoint[];
  testID?: string;
};

type TableRow = {
  id: string;
  date: string;
  weight: string;
  stage: string;
};

/**
 * Create table data from chart data points
 */
function createTableData(
  data: ChartDataPoint[],
  t: any,
  i18n: any
): TableRow[] {
  return data.map((point, index) => ({
    id: `${point.date.getTime()}-${index}`,
    date: formatDate(point.date, i18n.language),
    weight: formatWeight(point.weight_g),
    stage: t(`harvest.stages.${point.stage as HarvestStage}`),
  }));
}

/**
 * Table header cell component
 */
function TableHeaderCell({
  children,
  isTest,
}: {
  children: React.ReactNode;
  isTest: boolean;
}) {
  return (
    <Text
      {...(isTest
        ? {
            style: {
              flex: 1,
              fontSize: 14,
              fontWeight: '600' as const,
              color: '#1c1917',
            },
          }
        : {
            className:
              'flex-1 text-sm font-semibold text-charcoal-950 dark:text-neutral-100',
          })}
    >
      {children}
    </Text>
  );
}

/**
 * Render table header
 */
function TableHeader({ isTest, t }: { isTest: boolean; t: any }) {
  return (
    <View
      {...(isTest
        ? {
            style: {
              marginBottom: 8,
              flexDirection: 'row' as const,
              borderBottomWidth: 1,
              borderBottomColor: '#d1d5db',
              paddingBottom: 8,
            },
          }
        : {
            className:
              'mb-2 flex-row border-b border-neutral-300 pb-2 dark:border-neutral-700',
          })}
    >
      <TableHeaderCell isTest={isTest}>
        {t('harvest.chart.table.date')}
      </TableHeaderCell>
      <TableHeaderCell isTest={isTest}>
        {t('harvest.chart.table.weight')}
      </TableHeaderCell>
      <TableHeaderCell isTest={isTest}>
        {t('harvest.chart.table.stage')}
      </TableHeaderCell>
    </View>
  );
}

/**
 * Table fallback for chart rendering errors
 * Requirement 4.6
 */
export function WeightChartTable({ data, testID }: Props) {
  const { t, i18n } = useTranslation();
  const tableData = createTableData(data, t, i18n);
  const isTest = __DEV__ && typeof jest !== 'undefined';

  return (
    <View
      testID={testID}
      {...(isTest ? { style: { flex: 1 } } : { className: 'flex-1' })}
    >
      <TableHeader isTest={isTest} t={t} />

      {/* Data rows using FlashList v2 */}
      <FlashList
        data={tableData}
        renderItem={({ item }) => <TableRowItem item={item} />}
        testID="table-list"
      />
    </View>
  );
}

/**
 * Table row component
 */
function TableRowItem({ item }: { item: TableRow }) {
  // In tests, avoid CSS interop issues by using inline styles
  const isTest = __DEV__ && typeof jest !== 'undefined';

  return (
    <View
      {...(isTest
        ? {
            style: {
              flexDirection: 'row' as const,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
              paddingVertical: 8,
            },
          }
        : {
            className:
              'flex-row border-b border-neutral-200 py-2 dark:border-neutral-800',
          })}
    >
      <Text
        {...(isTest
          ? { style: { flex: 1, fontSize: 14, color: '#1c1917' } }
          : {
              className:
                'flex-1 text-sm text-charcoal-950 dark:text-neutral-100',
            })}
      >
        {item.date}
      </Text>
      <Text
        {...(isTest
          ? { style: { flex: 1, fontSize: 14, color: '#1c1917' } }
          : {
              className:
                'flex-1 text-sm text-charcoal-950 dark:text-neutral-100',
            })}
      >
        {item.weight}
      </Text>
      <Text
        {...(isTest
          ? { style: { flex: 1, fontSize: 14, color: '#1c1917' } }
          : {
              className:
                'flex-1 text-sm text-charcoal-950 dark:text-neutral-100',
            })}
      >
        {item.stage}
      </Text>
    </View>
  );
}

/**
 * Format date for table display
 */
function formatDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale || 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
