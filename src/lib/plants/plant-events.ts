import { Q } from '@nozbe/watermelondb';

import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { triggerDigitalTwinSync } from '@/lib/digital-twin/sync-helpers';
import { database } from '@/lib/watermelon';
import type { PlantEventModel } from '@/lib/watermelon-models/plant-event';

import { PlantEventKind, type PlantEventKindValue } from './plant-event-kinds';
export { PlantEventKind };
export type { PlantEventKindValue };

export type PlantEventPayload = Record<string, unknown> | null;

export type PlantEvent = {
  id: string;
  plantId: string;
  kind: PlantEventKindValue;
  occurredAt: number;
  payload?: PlantEventPayload;
  userId?: string;
};

type RecordPlantEventInput = {
  plantId: string;
  kind: PlantEventKindValue;
  occurredAt?: number;
  payload?: PlantEventPayload;
  userId?: string | null;
};

function getCollection() {
  return database.get<PlantEventModel>('plant_events');
}

function toPlantEvent(model: PlantEventModel): PlantEvent {
  return {
    id: model.id,
    plantId: model.plantId,
    kind: model.kind as PlantEventKindValue,
    occurredAt: model.occurredAt,
    payload: model.payload ?? undefined,
    userId: model.userId ?? undefined,
  };
}

export async function recordPlantEvent(
  input: RecordPlantEventInput
): Promise<PlantEvent> {
  const now = Date.now();
  const occurredAt = input.occurredAt ?? now;
  const userId =
    input.userId ?? (await getOptionalAuthenticatedUserId()) ?? undefined;

  const created = await database.write(async () => {
    return getCollection().create((record) => {
      record.plantId = input.plantId;
      record.kind = input.kind;
      record.occurredAt = occurredAt;
      if (input.payload !== undefined) {
        record.payload = input.payload ?? undefined;
      }
      if (userId) record.userId = userId;
      record.createdAt = new Date(now);
      record.updatedAt = new Date(now);
    });
  });

  triggerDigitalTwinSync(input.plantId, 'PlantEvents');

  return toPlantEvent(created);
}

export async function listPlantEvents(params: {
  plantId: string;
  kind?: PlantEventKindValue;
  limit?: number;
}): Promise<PlantEvent[]> {
  const { plantId, kind, limit = 100 } = params;
  const conditions = [
    Q.where('plant_id', plantId),
    Q.where('deleted_at', null),
  ];
  if (kind) {
    conditions.push(Q.where('kind', kind));
  }

  const rows = await getCollection()
    .query(...conditions, Q.sortBy('occurred_at', Q.desc), Q.take(limit))
    .fetch();

  return rows.map(toPlantEvent);
}
