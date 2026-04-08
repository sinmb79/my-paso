"use client";

import { useEffect, useState } from "react";

import { useLocalDB } from "@/hooks/useLocalDB";
import {
  createReview,
  createVisit,
  getPOIs,
  getProfile,
  getRecentReviews,
  getRecentVisits,
  getStats,
} from "@/lib/db/queries";
import { loadSeedPOIs } from "@/lib/poi/seed-loader";
import type {
  CreateReviewInput,
  CreateVisitInput,
  PasoDatabase,
  POI,
  Profile,
  Review,
  Stats,
  Visit,
} from "@/types";

type PasoJournalData = {
  pois: POI[];
  profile: Profile;
  recentReviews: Review[];
  recentVisits: Visit[];
  selectedPoiId: string | null;
  stats: Stats;
};

type PasoJournalState =
  | ({
      status: "loading";
      error: null;
    } & PasoJournalData)
  | ({
      status: "ready";
      error: null;
    } & PasoJournalData)
  | ({
      status: "error";
      error: Error;
    } & PasoJournalData);

export type PasoJournalController = {
  status: PasoJournalState["status"];
  error: Error | null;
  pois: POI[];
  profile: Profile;
  recentReviews: Review[];
  recentVisits: Visit[];
  selectedPoi: POI | null;
  selectedVisit: Visit | null;
  stats: Stats;
  database: PasoDatabase | null;
  setSelectedPoiId: (poiId: string) => void;
  recordVisit: (input: CreateVisitInput) => Promise<Visit>;
  saveReview: (input: CreateReviewInput) => Promise<Review>;
  refresh: () => Promise<void>;
};

const EMPTY_PROFILE: Profile = {
  nickname: "Paso Walker",
  created_at: new Date(0).toISOString(),
  total_xp: 0,
  level: 1,
};

const EMPTY_STATS: Stats = {
  total_visits: 0,
  unique_pois_visited: 0,
  total_reviews: 0,
  total_photos: 0,
  total_distance_km: 0,
  total_xp: 0,
  level: 1,
  current_streak: 0,
  steps_today: 0,
  steps_weekly_avg: 0,
  updated_at: new Date(0).toISOString(),
};

function createEmptyState(): PasoJournalData {
  return {
    pois: [],
    profile: EMPTY_PROFILE,
    recentReviews: [],
    recentVisits: [],
    selectedPoiId: null,
    stats: EMPTY_STATS,
  };
}

async function loadJournalSnapshot(database: PasoDatabase, limit: number) {
  await loadSeedPOIs(database);
  const pois = await getPOIs(database, 100);
  const profile = await getProfile(database);
  const stats = await getStats(database);
  const recentVisits = await getRecentVisits(database, limit);
  const recentReviews = await getRecentReviews(database, limit);

  return {
    pois,
    profile,
    stats,
    recentVisits,
    recentReviews,
  };
}

export function usePasoJournal(limit = 8): PasoJournalController {
  const localDatabase = useLocalDB();
  const [state, setState] = useState<PasoJournalState>({
    status: "loading",
    error: null,
    ...createEmptyState(),
  });

  useEffect(() => {
    let cancelled = false;

    if (localDatabase.status !== "ready") {
      return () => {
        cancelled = true;
      };
    }

    void loadJournalSnapshot(localDatabase.database, limit)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          status: "ready",
          error: null,
          ...snapshot,
          selectedPoiId:
            current.selectedPoiId &&
            snapshot.pois.some((poi) => poi.id === current.selectedPoiId)
              ? current.selectedPoiId
              : snapshot.pois[0]?.id ?? null,
        }));
      })
      .catch((snapshotError: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          error:
            snapshotError instanceof Error
              ? snapshotError
              : new Error("Failed to load local journal."),
          ...createEmptyState(),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [limit, localDatabase]);

  const effectiveState: PasoJournalState =
    localDatabase.status === "error"
      ? {
          status: "error",
          error: localDatabase.error,
          ...createEmptyState(),
        }
      : state;

  async function refreshSnapshot(database: PasoDatabase) {
    const snapshot = await loadJournalSnapshot(database, limit);
    setState((current) => ({
      status: "ready",
      error: null,
      ...snapshot,
      selectedPoiId:
        current.selectedPoiId &&
        snapshot.pois.some((poi) => poi.id === current.selectedPoiId)
          ? current.selectedPoiId
          : snapshot.pois[0]?.id ?? null,
    }));

    return snapshot;
  }

  const selectedPoi =
    effectiveState.selectedPoiId == null
      ? null
      : effectiveState.pois.find((poi) => poi.id === effectiveState.selectedPoiId) ??
        null;
  const selectedVisit =
    selectedPoi == null
      ? null
      : effectiveState.recentVisits.find((visit) => visit.poi_id === selectedPoi.id) ??
        null;

  return {
    ...effectiveState,
    selectedPoi,
    selectedVisit,
    setSelectedPoiId(poiId: string) {
      setState((current) => ({
        ...current,
        selectedPoiId: poiId,
      }));
    },
    async recordVisit(input: CreateVisitInput) {
      if (localDatabase.status !== "ready") {
        throw new Error("Local database is not ready.");
      }

      const visit = await createVisit(localDatabase.database, input);
      await refreshSnapshot(localDatabase.database);
      return visit;
    },
    async saveReview(input: CreateReviewInput) {
      if (localDatabase.status !== "ready") {
        throw new Error("Local database is not ready.");
      }

      const review = await createReview(localDatabase.database, input);
      await refreshSnapshot(localDatabase.database);
      return review;
    },
    async refresh() {
      if (localDatabase.status !== "ready") {
        throw new Error("Local database is not ready.");
      }

      await refreshSnapshot(localDatabase.database);
    },
    database:
      localDatabase.status === "ready" ? localDatabase.database : null,
  };
}
