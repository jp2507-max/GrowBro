import { Q } from '@nozbe/watermelondb';
import type { StateCreator } from 'zustand';
import { create } from 'zustand';

import { getAnalyticsClient } from '@/lib/analytics-registry';
import { getItem, removeItem, setItem } from '@/lib/storage';
import { performSync } from '@/lib/sync/sync-coordinator';
import { getPendingChangesCount } from '@/lib/sync-engine';
import { createSelectors } from '@/lib/utils';
import { database } from '@/lib/watermelon';
import { ensureNutrientEngineIndexes } from '@/lib/watermelon-indexes';
import type { CalibrationModel } from '@/lib/watermelon-models/calibration';
import type { DeviationAlertModel } from '@/lib/watermelon-models/deviation-alert';
import type { PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';

import {
  acknowledgeAlert as acknowledgeAlertService,
  resolveAlert as resolveAlertService,
} from '../services/alert-service';
import {
  getActiveCalibration,
  modelToCalibration,
  recordCalibration as recordCalibrationService,
  validateCalibration as validateCalibrationService,
} from '../services/calibration-service';
import {
  createCalendarTaskFromEvent,
  type FeedingSchedule,
  generateSchedule,
} from '../services/schedule-service';
import {
  applyStrainAdjustments as applyStrainAdjustmentsService,
  createStarterTemplate,
  createTemplate,
  type CreateTemplateOptions,
  deleteTemplate,
  type StrainAdjustment,
  updateTemplate,
  type UpdateTemplateOptions,
} from '../services/template-service';
import {
  type Calibration,
  type CalibrationStatus,
  CalibrationType,
  type DeviationAlert,
  MeasurementMode,
  type PhEcReading,
  type PpmScale,
} from '../types';
import { computeQualityFlags, toEC25 } from '../utils/conversions';

const PREFERENCES_STORAGE_KEY = 'nutrient-engine.preferences';

type NutrientEnginePreferences = {
  ppmScale: PpmScale;
  tempCompensationBeta: number;
  alertCooldownMinutes: number;
};

type NutrientEngineUIState = {
  selectedPlantId?: string;
  selectedReservoirId?: string;
  measurementMode: MeasurementMode;
};

type NutrientEnginePendingState = {
  pendingReadings: number;
  pendingAlerts: number;
  pendingSyncItems: number;
};

const DEFAULT_PREFERENCES: NutrientEnginePreferences = {
  ppmScale: '500',
  tempCompensationBeta: 0.02,
  alertCooldownMinutes: 30,
};

const STORED_PREFERENCES = getItem<NutrientEnginePreferences>(
  PREFERENCES_STORAGE_KEY
);

const INITIAL_PREFERENCES: NutrientEnginePreferences = {
  ...DEFAULT_PREFERENCES,
  ...(STORED_PREFERENCES ?? {}),
};

const INITIAL_UI_STATE: NutrientEngineUIState = {
  selectedPlantId: undefined,
  selectedReservoirId: undefined,
  measurementMode: MeasurementMode.MANUAL,
};

const INITIAL_PENDING_STATE: NutrientEnginePendingState = {
  pendingReadings: 0,
  pendingAlerts: 0,
  pendingSyncItems: 0,
};

function trackNutrientUsage(
  feature:
    | 'log_reading'
    | 'acknowledge_alert'
    | 'resolve_alert'
    | 'apply_template'
    | 'sync_now'
    | 'set_measurement_mode',
  payload: Record<string, unknown> = {}
): void {
  const analytics = getAnalyticsClient();
  try {
    void analytics.track('nutrient_feature_usage', {
      feature,
      ...payload,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[nutrient-analytics] track failed', error);
    }
  }
}

type LogReadingInput = {
  plantId?: string;
  reservoirId?: string;
  measuredAt: number;
  ph: number;
  ecRaw: number;
  tempC: number;
  atcOn: boolean;
  ppmScale: PpmScale;
  meterId?: string;
  note?: string;
};

type ApplyTemplateOptions = {
  plantId: string;
  templateId: string;
  startDate: number;
  reservoirVolumeL?: number;
};

type ApplyTemplateResult = {
  schedule: FeedingSchedule;
  calendarTasks: ReturnType<typeof createCalendarTaskFromEvent>[];
};

type NutrientEngineStoreState = {
  ui: NutrientEngineUIState;
  pendingActions: NutrientEnginePendingState;
  preferences: NutrientEnginePreferences;
};

export type NutrientEngineActions = {
  setSelectedPlantId: (plantId?: string) => void;
  setSelectedReservoirId: (reservoirId?: string) => void;
  setMeasurementMode: (mode: MeasurementMode) => void;
  setPreference: <K extends keyof NutrientEnginePreferences>(
    key: K,
    value: NutrientEnginePreferences[K]
  ) => void;
  setPreferences: (prefs: Partial<NutrientEnginePreferences>) => void;
  reset: () => void;
  logReading: (input: LogReadingInput) => Promise<PhEcReading>;
  syncNow: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<DeviationAlert>;
  resolveAlert: (alertId: string) => Promise<DeviationAlert>;
  recordCalibration: (data: RecordCalibrationInput) => Promise<Calibration>;
  validateCalibration: (
    meterId: string,
    type: CalibrationType
  ) => Promise<CalibrationStatus>;
  createTemplate: (options: CreateTemplateOptions) => Promise<void>;
  updateTemplate: (
    templateId: string,
    updates: UpdateTemplateOptions
  ) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  createStarterTemplate: (
    medium: CreateTemplateOptions['medium'],
    name?: string
  ) => Promise<void>;
  applyStrainAdjustments: (
    baseTemplateId: string,
    adjustment: StrainAdjustment
  ) => Promise<void>;
  applyTemplate: (
    options: ApplyTemplateOptions
  ) => Promise<ApplyTemplateResult>;
  startPendingObservers: () => void;
  stopPendingObservers: () => void;
  refreshPendingSyncCount: () => Promise<void>;
};

type NutrientEngineStore = NutrientEngineStoreState & {
  actions: NutrientEngineActions;
};

type StoreSet = Parameters<StateCreator<NutrientEngineStore>>[0];
type StoreGet = Parameters<StateCreator<NutrientEngineStore>>[1];

type RecordCalibrationInput = {
  meterId: string;
  type: CalibrationType;
  points: Calibration['points'];
  tempC: number;
  method: NonNullable<Calibration['method']>;
  validDays?: number;
};

type SubscriptionLike = {
  unsubscribe: () => void;
};

// Track active Watermelon subscriptions to avoid leaks when toggling observers.
const pendingSubscriptions: SubscriptionLike[] = [];
let observersActive = false;

function mapReadingModel(model: PhEcReadingModel): PhEcReading {
  return {
    id: model.id,
    plantId: model.plantId ?? undefined,
    reservoirId: model.reservoirId ?? undefined,
    measuredAt: model.measuredAt,
    ph: model.ph,
    ecRaw: model.ecRaw,
    ec25c: model.ec25c,
    tempC: model.tempC,
    atcOn: model.atcOn,
    ppmScale: model.ppmScale as PpmScale,
    meterId: model.meterId ?? undefined,
    note: model.note ?? undefined,
    qualityFlags: model.qualityFlags ?? [],
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}

function mapAlertModel(model: DeviationAlertModel): DeviationAlert {
  return {
    id: model.id,
    readingId: model.readingId,
    type: model.type as DeviationAlert['type'],
    severity: model.severity as DeviationAlert['severity'],
    message: model.message,
    recommendations: model.recommendations,
    recommendationCodes: model.recommendationCodes ?? [],
    cooldownUntil: model.cooldownUntil ?? undefined,
    triggeredAt: model.triggeredAt,
    acknowledgedAt: model.acknowledgedAt ?? undefined,
    resolvedAt: model.resolvedAt ?? undefined,
    deliveredAtLocal: model.deliveredAtLocal ?? undefined,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}

function mapCalibrationModel(model: CalibrationModel): Calibration {
  return modelToCalibration(model);
}

function buildPendingTotals(
  current: NutrientEnginePendingState,
  overrides: Partial<NutrientEnginePendingState> = {}
): NutrientEnginePendingState {
  const merged: NutrientEnginePendingState = {
    ...current,
    ...overrides,
  };
  const minSyncCount = merged.pendingAlerts + merged.pendingReadings;
  return {
    ...merged,
    pendingSyncItems: Math.max(minSyncCount, merged.pendingSyncItems),
  };
}

async function createReadingRecord(
  input: LogReadingInput,
  preferences: NutrientEnginePreferences
): Promise<PhEcReading> {
  const ec25c = input.atcOn
    ? input.ecRaw
    : toEC25(input.ecRaw, input.tempC, preferences.tempCompensationBeta);

  const calibrationModel = input.meterId
    ? await getActiveCalibration(input.meterId, CalibrationType.EC)
    : null;

  const calibration = calibrationModel
    ? mapCalibrationModel(calibrationModel)
    : undefined;

  const readingForFlags: PhEcReading = {
    id: 'temporary',
    plantId: input.plantId,
    reservoirId: input.reservoirId,
    measuredAt: input.measuredAt,
    ph: input.ph,
    ecRaw: input.ecRaw,
    ec25c,
    tempC: input.tempC,
    atcOn: input.atcOn,
    ppmScale: input.ppmScale,
    meterId: input.meterId,
    note: input.note,
    qualityFlags: [],
    createdAt: input.measuredAt,
    updatedAt: input.measuredAt,
  };

  const qualityFlags = computeQualityFlags(readingForFlags, calibration);
  const readingsCollection =
    database.get<PhEcReadingModel>('ph_ec_readings_v2');

  const created = await database.write(async () => {
    return readingsCollection.create((record) => {
      record.plantId = input.plantId;
      record.reservoirId = input.reservoirId;
      record.measuredAt = input.measuredAt;
      record.ph = input.ph;
      record.ecRaw = input.ecRaw;
      record.ec25c = ec25c;
      record.tempC = input.tempC;
      record.atcOn = input.atcOn;
      record.ppmScale = input.ppmScale;
      record.meterId = input.meterId;
      record.note = input.note;
      record.qualityFlags = qualityFlags;
      const now = new Date();
      record.createdAt = now;
      record.updatedAt = now;
    });
  });

  return mapReadingModel(created);
}

function createUiActions(
  set: StoreSet
): Pick<
  NutrientEngineActions,
  'setMeasurementMode' | 'setSelectedPlantId' | 'setSelectedReservoirId'
> {
  return {
    setSelectedPlantId: (plantId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedPlantId: plantId,
        },
      }));
    },
    setSelectedReservoirId: (reservoirId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedReservoirId: reservoirId,
        },
      }));
    },
    setMeasurementMode: (mode) => {
      set((state) => ({
        ui: {
          ...state.ui,
          measurementMode: mode,
        },
      }));
      trackNutrientUsage('set_measurement_mode', {
        measurement_mode: String(mode),
      });
    },
  };
}

function createPreferenceActions(
  set: StoreSet
): Pick<NutrientEngineActions, 'setPreference' | 'setPreferences'> {
  const persist = (prefs: NutrientEnginePreferences) => {
    setItem(PREFERENCES_STORAGE_KEY, prefs);
  };

  return {
    setPreference: (key, value) => {
      set((state) => {
        const next = {
          ...state.preferences,
          [key]: value,
        };
        persist(next);
        return { preferences: next };
      });
    },
    setPreferences: (prefs) => {
      set((state) => {
        const next = {
          ...state.preferences,
          ...prefs,
        };
        persist(next);
        return { preferences: next };
      });
    },
  };
}

function createMeasurementActions(
  set: StoreSet,
  get: StoreGet
): Pick<NutrientEngineActions, 'logReading' | 'syncNow'> {
  return {
    logReading: async (input) => {
      const reading = await createReadingRecord(input, get().preferences);
      set((state) => ({
        pendingActions: buildPendingTotals(state.pendingActions, {
          pendingReadings: state.pendingActions.pendingReadings + 1,
        }),
      }));
      trackNutrientUsage('log_reading', {
        has_plant: Boolean(input.plantId),
        has_reservoir: Boolean(input.reservoirId),
        has_meter: Boolean(input.meterId),
        has_note: Boolean(input.note),
        ppm_scale: input.ppmScale,
        atc_on: input.atcOn,
      });
      return reading;
    },
    syncNow: async () => {
      const pendingBefore = get().pendingActions.pendingSyncItems;
      const result = await performSync({
        withRetry: true,
        maxRetries: 5,
        trackAnalytics: true,
        trigger: 'manual',
      });
      await get().actions.refreshPendingSyncCount();
      const pendingAfter = get().pendingActions.pendingSyncItems;
      trackNutrientUsage('sync_now', {
        attempts: result.attempts ?? 1,
        pushed: result.pushed,
        applied: result.applied,
        pending_before: pendingBefore,
        pending_after: pendingAfter,
      });
    },
  };
}

function createAlertActions(): Pick<
  NutrientEngineActions,
  'acknowledgeAlert' | 'resolveAlert'
> {
  return {
    acknowledgeAlert: async (alertId) => {
      const updated = await acknowledgeAlertService(alertId);
      const alert = mapAlertModel(updated);
      trackNutrientUsage('acknowledge_alert', {
        alert_type: alert.type,
        severity: alert.severity,
      });
      return alert;
    },
    resolveAlert: async (alertId) => {
      const updated = await resolveAlertService(alertId);
      const alert = mapAlertModel(updated);
      trackNutrientUsage('resolve_alert', {
        alert_type: alert.type,
        severity: alert.severity,
      });
      return alert;
    },
  };
}

function createCalibrationActions(): Pick<
  NutrientEngineActions,
  'recordCalibration' | 'validateCalibration'
> {
  return {
    recordCalibration: async (data) => {
      const calibration = await recordCalibrationService(data);
      return mapCalibrationModel(calibration);
    },
    validateCalibration: async (meterId, type) => {
      return validateCalibrationService(meterId, type);
    },
  };
}

function createTemplateActions(
  get: StoreGet
): Pick<
  NutrientEngineActions,
  | 'applyStrainAdjustments'
  | 'applyTemplate'
  | 'createStarterTemplate'
  | 'createTemplate'
  | 'deleteTemplate'
  | 'updateTemplate'
> {
  return {
    createTemplate: async (options) => {
      await createTemplate(database, options);
    },
    updateTemplate: async (templateId, updates) => {
      await updateTemplate(database, templateId, updates);
    },
    deleteTemplate: async (templateId) => {
      await deleteTemplate(database, templateId);
    },
    createStarterTemplate: async (medium, name) => {
      await createStarterTemplate(database, medium, name);
    },
    applyStrainAdjustments: async (baseTemplateId, adjustment) => {
      await applyStrainAdjustmentsService(database, baseTemplateId, adjustment);
    },
    applyTemplate: async ({
      plantId,
      templateId,
      startDate,
      reservoirVolumeL,
    }) => {
      const schedule = await generateSchedule(database, {
        plantId,
        templateId,
        startDate,
        reservoirVolumeL,
      });

      const tasks = schedule.events.map((event) =>
        createCalendarTaskFromEvent(event, get().preferences.ppmScale)
      );

      trackNutrientUsage('apply_template', {
        event_count: schedule.events.length,
        has_reservoir_volume: typeof reservoirVolumeL === 'number',
        has_calendar_tasks: tasks.length > 0,
      });

      return {
        schedule,
        calendarTasks: tasks,
      };
    },
  };
}

function createObserverActions(
  set: StoreSet
): Pick<
  NutrientEngineActions,
  'refreshPendingSyncCount' | 'startPendingObservers' | 'stopPendingObservers'
> {
  return {
    startPendingObservers: () => {
      if (observersActive) return;

      const pendingReadingsQuery = database
        .get<PhEcReadingModel>('ph_ec_readings_v2')
        .query(Q.where('_status', Q.oneOf(['created', 'updated'])));

      const pendingAlertsQuery = database
        .get<DeviationAlertModel>('deviation_alerts_v2')
        .query(Q.where('_status', Q.oneOf(['created', 'updated'])));

      const readingsSubscription = pendingReadingsQuery
        .observeCount()
        .subscribe({
          next: (count: number) => {
            set((state) => ({
              pendingActions: buildPendingTotals(state.pendingActions, {
                pendingReadings: count,
              }),
            }));
          },
          error: (error: unknown) => {
            console.error(
              '[nutrient-engine-store] observeCount subscription error',
              error
            );
          },
        });

      const alertsSubscription = pendingAlertsQuery.observeCount().subscribe({
        next: (count: number) => {
          set((state) => ({
            pendingActions: buildPendingTotals(state.pendingActions, {
              pendingAlerts: count,
            }),
          }));
        },
        error: (error: unknown) => {
          console.error(
            '[nutrient-engine-store] observeCount subscription error',
            error
          );
        },
      });

      pendingSubscriptions.push(readingsSubscription, alertsSubscription);
      observersActive = true;
    },
    stopPendingObservers: () => {
      while (pendingSubscriptions.length > 0) {
        pendingSubscriptions.pop()?.unsubscribe();
      }
      observersActive = false;
    },
    refreshPendingSyncCount: async () => {
      const pending = await getPendingChangesCount();
      set((state) => ({
        pendingActions: buildPendingTotals(state.pendingActions, {
          pendingSyncItems: pending,
        }),
      }));
    },
  };
}

function createActions(set: StoreSet, get: StoreGet): NutrientEngineActions {
  const actions: Partial<NutrientEngineActions> = {
    ...createUiActions(set),
    ...createPreferenceActions(set),
    ...createMeasurementActions(set, get),
    ...createAlertActions(),
    ...createCalibrationActions(),
    ...createTemplateActions(get),
    ...createObserverActions(set),
  };

  actions.reset = () => {
    if (observersActive) {
      actions.stopPendingObservers?.();
    }

    set({
      ui: { ...INITIAL_UI_STATE },
      pendingActions: { ...INITIAL_PENDING_STATE },
      preferences: { ...DEFAULT_PREFERENCES },
    });

    removeItem(PREFERENCES_STORAGE_KEY);
  };

  return actions as NutrientEngineActions;
}

const createStore: StateCreator<NutrientEngineStore> = (set, get) => ({
  ui: { ...INITIAL_UI_STATE },
  pendingActions: { ...INITIAL_PENDING_STATE },
  preferences: { ...INITIAL_PREFERENCES },
  actions: createActions(set, get),
});

const store = create<NutrientEngineStore>(createStore);

export const useNutrientEngineStore = createSelectors(store);

export function getNutrientEngineState(): NutrientEngineStore {
  return store.getState();
}

void ensureNutrientEngineIndexes();
