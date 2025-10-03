import * as React from 'react';

import type { Effect, Flavor, Strain } from '@/api';
import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  strain: Strain;
  testID?: string;
};

function GeneticsSection({ strain }: { strain: Strain }) {
  const hasGenetics =
    strain.genetics &&
    (strain.genetics.parents.length > 0 || strain.genetics.lineage);

  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {translate('strains.detail.genetics')}
      </Text>
      {hasGenetics ? (
        <>
          {strain.genetics.parents.length > 0 && (
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              {strain.genetics.parents.join(' × ')}
            </Text>
          )}
          {strain.genetics.lineage && (
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {strain.genetics.lineage}
            </Text>
          )}
        </>
      ) : (
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {translate('strains.detail.not_reported')}
        </Text>
      )}
    </View>
  );
}

function EffectsSection({ effects }: { effects: Effect[] }) {
  return (
    <View className="mb-3">
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {translate('strains.detail.effects')}
      </Text>
      {effects.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {effects.map((effect, index) => (
            <View
              key={index}
              className="rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900"
            >
              <Text className="text-xs font-medium text-primary-800 dark:text-primary-100">
                {effect.name}
                {effect.intensity ? ` (${effect.intensity})` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {translate('strains.detail.not_reported')}
        </Text>
      )}
    </View>
  );
}

function FlavorsSection({ flavors }: { flavors: Flavor[] }) {
  return (
    <View>
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {translate('strains.detail.flavors')}
      </Text>
      {flavors.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {flavors.map((flavor, index) => (
            <View
              key={index}
              className="rounded-full bg-success-100 px-3 py-1 dark:bg-success-900"
            >
              <Text className="text-xs font-medium text-success-800 dark:text-success-100">
                {flavor.name}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {translate('strains.detail.not_reported')}
        </Text>
      )}
    </View>
  );
}

export const QuickFacts = React.memo<Props>(({ strain, testID }) => {
  return (
    <View
      className="mx-4 mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900"
      testID={testID}
    >
      <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('strains.detail.quick_facts')}
      </Text>
      <GeneticsSection strain={strain} />
      <EffectsSection effects={strain.effects || []} />
      <FlavorsSection flavors={strain.flavors || []} />
    </View>
  );
});

QuickFacts.displayName = 'QuickFacts';
