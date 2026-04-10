import type { NearbyPOIMatch } from "@/lib/geo/geofence";

const DEFAULT_DWELL_THRESHOLD_MINUTES = 3;

export type DwellState = {
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  poiId: string | null;
  triggeredAt: string | null;
};

export function createEmptyDwellState(): DwellState {
  return {
    poiId: null,
    firstSeenAt: null,
    lastSeenAt: null,
    triggeredAt: null,
  };
}

function toTimestamp(value: string) {
  return new Date(value).getTime();
}

export function checkDwell(
  currentState: DwellState,
  nearbyPoi: NearbyPOIMatch | null,
  now: string,
  dwellThresholdMinutes = DEFAULT_DWELL_THRESHOLD_MINUTES,
) {
  if (!nearbyPoi) {
    return {
      dwellState: createEmptyDwellState(),
      visitTriggered: null,
    };
  }

  if (currentState.poiId !== nearbyPoi.poi.id) {
    return {
      dwellState: {
        poiId: nearbyPoi.poi.id,
        firstSeenAt: now,
        lastSeenAt: now,
        triggeredAt: null,
      },
      visitTriggered: null,
    };
  }

  const dwellState: DwellState = {
    ...currentState,
    lastSeenAt: now,
  };

  if (currentState.triggeredAt) {
    return {
      dwellState,
      visitTriggered: null,
    };
  }

  const firstSeenAt = currentState.firstSeenAt ?? now;
  const dwellDurationMinutes =
    (toTimestamp(now) - toTimestamp(firstSeenAt)) / 60_000;

  if (dwellDurationMinutes < dwellThresholdMinutes) {
    return {
      dwellState,
      visitTriggered: null,
    };
  }

  return {
    dwellState: {
      ...dwellState,
      triggeredAt: now,
    },
    visitTriggered: nearbyPoi.poi.id,
  };
}
