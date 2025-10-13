/**
 * API layer for reservoir event management
 *
 * Provides React Query hooks for creating and fetching reservoir events
 * with offline queue support.
 *
 * Requirements: 1.6, 2.5, 2.8, 6.2, 6.3
 */

import { Q } from '@nozbe/watermelondb';
import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';

import {
  calculateDilutionRecommendation,
  calculateDoseRecommendation,
  createReservoirEvent,
  type DilutionCalculationParams,
  type DoseCalculationParams,
  listEventsByDateRange,
  listEventsByReservoir,
  undoLastEvent,
} from '@/lib/nutrient-engine/services/reservoir-event-service';
import type {
  ReservoirEvent,
  ReservoirEventKind,
} from '@/lib/nutrient-engine/types';
import { database } from '@/lib/watermelon';
import type { ReservoirEventModel } from '@/lib/watermelon-models/reservoir-event';

import { client } from '../common';

// ============================================================================
// Types
// ============================================================================

type CreateEventVariables = {
  reservoirId: string;
  kind: ReservoirEventKind;
  deltaEc25c?: number;
  deltaPh?: number;
  note?: string;
};

type CreateEventResponse = ReservoirEvent;

type FetchEventsVariables = {
  reservoirId: string;
  limit?: number;
};

type FetchEventsResponse = ReservoirEvent[];

type FetchEventsByDateRangeVariables = {
  reservoirId: string;
  startMs: number;
  endMs: number;
};

type UndoEventVariables = {
  reservoirId: string;
};

type UndoEventResponse = ReservoirEvent | null;

type DoseRecommendationVariables = DoseCalculationParams;

type DilutionRecommendationVariables = DilutionCalculationParams;

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * Creates a reservoir event on the server
 */
async function createEventOnServer(
  variables: CreateEventVariables
): Promise<CreateEventResponse> {
  const response = await client.post<CreateEventResponse>('/reservoir-events', {
    reservoir_id: variables.reservoirId,
    kind: variables.kind,
    delta_ec_25c: variables.deltaEc25c,
    delta_ph: variables.deltaPh,
    note: variables.note,
  });
  return response.data;
}

/**
 * Fetches events from the server
 */
async function fetchEventsFromServer(
  variables: FetchEventsVariables
): Promise<FetchEventsResponse> {
  const response = await client.get<FetchEventsResponse>('/reservoir-events', {
    params: {
      reservoir_id: variables.reservoirId,
      limit: variables.limit || 100,
    },
  });
  return response.data;
}

/**
 * Fetches events by date range from the server
 */
async function fetchEventsByDateRangeFromServer(
  variables: FetchEventsByDateRangeVariables
): Promise<FetchEventsResponse> {
  const response = await client.get<FetchEventsResponse>('/reservoir-events', {
    params: {
      reservoir_id: variables.reservoirId,
      start_ms: variables.startMs,
      end_ms: variables.endMs,
    },
  });
  return response.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Mutation hook for creating a reservoir event
 *
 * Creates event locally first (offline-first), then syncs to server
 */
export const useCreateReservoirEvent = createMutation<
  CreateEventResponse,
  CreateEventVariables,
  AxiosError
>({
  mutationKey: ['reservoir-events', 'create'],
  mutationFn: async (variables) => {
    // Create locally first (offline-first)
    const localEvent = await createReservoirEvent({
      reservoirId: variables.reservoirId,
      kind: variables.kind,
      deltaEc25c: variables.deltaEc25c,
      deltaPh: variables.deltaPh,
      note: variables.note,
    });

    // Convert to response type
    const response: CreateEventResponse = {
      id: localEvent.id,
      reservoirId: localEvent.reservoirId,
      kind: localEvent.kind as ReservoirEventKind,
      deltaEc25c: localEvent.deltaEc25c,
      deltaPh: localEvent.deltaPh,
      note: localEvent.note,
      createdAt: localEvent.createdAt.getTime(),
      updatedAt: localEvent.updatedAt.getTime(),
    };

    // Queue for server sync in background
    try {
      await createEventOnServer(variables);
    } catch (error) {
      // Log error but don't fail the mutation - sync will retry later
      console.warn('Failed to sync reservoir event to server:', error);
    }

    return response;
  },
});

/**
 * Query hook for fetching reservoir events
 *
 * Reads from local database (offline-first), falls back to server
 */
export const useReservoirEvents = (variables: FetchEventsVariables) => {
  return useQuery<FetchEventsResponse, AxiosError>({
    queryKey: ['reservoir-events', variables],
    queryFn: async () => {
      // Try local database first
      try {
        const localEvents = await listEventsByReservoir(
          variables.reservoirId,
          variables.limit
        );

        // Convert to response type
        const events: FetchEventsResponse = localEvents.map((event) => ({
          id: event.id,
          reservoirId: event.reservoirId,
          kind: event.kind as ReservoirEventKind,
          deltaEc25c: event.deltaEc25c,
          deltaPh: event.deltaPh,
          note: event.note,
          createdAt: event.createdAt.getTime(),
          updatedAt: event.updatedAt.getTime(),
        }));

        // If we have local data, return it immediately
        if (events.length > 0) {
          return events;
        }
      } catch (error) {
        console.warn('Failed to fetch local reservoir events:', error);
      }

      // Fall back to server if no local data
      return await fetchEventsFromServer(variables);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Query hook for fetching reservoir events by date range
 */
export const useReservoirEventsByDateRange = (
  variables: FetchEventsByDateRangeVariables
) => {
  return useQuery<FetchEventsResponse, AxiosError>({
    queryKey: ['reservoir-events', 'date-range', variables],
    queryFn: async () => {
      // Try local database first
      try {
        const localEvents = await listEventsByDateRange(
          variables.reservoirId,
          variables.startMs,
          variables.endMs
        );

        // Convert to response type
        const events: FetchEventsResponse = localEvents.map((event) => ({
          id: event.id,
          reservoirId: event.reservoirId,
          kind: event.kind as ReservoirEventKind,
          deltaEc25c: event.deltaEc25c,
          deltaPh: event.deltaPh,
          note: event.note,
          createdAt: event.createdAt.getTime(),
          updatedAt: event.updatedAt.getTime(),
        }));

        // Only return local events if we have any, otherwise fall back to server
        if (events.length > 0) {
          return events;
        }
      } catch (error) {
        console.warn('Failed to fetch local reservoir events:', error);
      }

      // Fall back to server (on error or when local result is empty)
      return await fetchEventsByDateRangeFromServer(variables);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Mutation hook for undoing the last reservoir event
 */
export const useUndoReservoirEvent = createMutation<
  UndoEventResponse,
  UndoEventVariables,
  AxiosError
>({
  mutationKey: ['reservoir-events', 'undo'],
  mutationFn: async (variables) => {
    // Undo locally first
    const undoEvent = await undoLastEvent(variables.reservoirId);

    if (!undoEvent) {
      return null;
    }

    // Convert to response type
    const response: CreateEventResponse = {
      id: undoEvent.id,
      reservoirId: undoEvent.reservoirId,
      kind: undoEvent.kind as ReservoirEventKind,
      deltaEc25c: undoEvent.deltaEc25c,
      deltaPh: undoEvent.deltaPh,
      note: undoEvent.note,
      createdAt: undoEvent.createdAt.getTime(),
      updatedAt: undoEvent.updatedAt.getTime(),
    };

    // Queue for server sync in background
    try {
      await createEventOnServer({
        reservoirId: undoEvent.reservoirId,
        kind: undoEvent.kind as ReservoirEventKind,
        deltaEc25c: undoEvent.deltaEc25c,
        deltaPh: undoEvent.deltaPh,
        note: undoEvent.note,
      });
    } catch (error) {
      console.warn('Failed to sync undo event to server:', error);
    }

    return response;
  },
});

// ============================================================================
// Local-Only Hooks (No Server Interaction)
// ============================================================================

/**
 * Function for calculating dose recommendations (client-side only)
 *
 * This is educational guidance and doesn't require server interaction
 */
export function doseRecommendation(variables: DoseRecommendationVariables) {
  return calculateDoseRecommendation(variables);
}

/**
 * Function for calculating dilution recommendations (client-side only)
 *
 * This is educational guidance and doesn't require server interaction
 */
export function dilutionRecommendation(
  variables: DilutionRecommendationVariables
) {
  return calculateDilutionRecommendation(variables);
}

// ============================================================================
// Direct Database Query Functions (for offline support)
// ============================================================================

/**
 * Fetches events from local database with WatermelonDB query
 *
 * Use this for real-time observables in UI components
 */
export async function fetchLocalReservoirEvents(
  reservoirId: string,
  limit: number = 100
): Promise<ReservoirEventModel[]> {
  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');

  return await eventsCollection
    .query(
      Q.where('reservoir_id', reservoirId),
      Q.sortBy('created_at', Q.desc),
      Q.take(limit)
    )
    .fetch();
}

/**
 * Observes events for a reservoir (reactive)
 *
 * Use this for chart annotations and real-time updates
 */
export function observeLocalReservoirEvents(
  reservoirId: string,
  limit: number = 100
) {
  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');

  return eventsCollection
    .query(
      Q.where('reservoir_id', reservoirId),
      Q.sortBy('created_at', Q.desc),
      Q.take(limit)
    )
    .observe();
}
