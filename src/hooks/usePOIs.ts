"use client";

import { useEffect, useState } from "react";

import { getPOIs } from "@/lib/db/queries";
import { loadSeedPOIs } from "@/lib/poi/seed-loader";
import { useLocalDB } from "@/hooks/useLocalDB";
import type { POI } from "@/types";

type POIState = {
  pois: POI[];
  status: "loading" | "ready" | "error";
  error: Error | null;
};

export function usePOIs(limit = 100): POIState {
  const localDatabase = useLocalDB();
  const [pois, setPOIs] = useState<POI[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (localDatabase.status !== "ready") {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadSeedPOIs(localDatabase.database);
        const seededPOIs = await getPOIs(localDatabase.database, limit);

        if (cancelled) {
          return;
        }

        setError(null);
        setPOIs(seededPOIs);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setError(
          error instanceof Error
            ? error
            : new Error("Failed to load bundled POIs."),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [limit, localDatabase]);

  if (localDatabase.status === "loading") {
    return {
      pois: [],
      status: "loading",
      error: null,
    };
  }

  if (localDatabase.status === "error") {
    return {
      pois: [],
      status: "error",
      error: localDatabase.error,
    };
  }

  if (error) {
    return {
      pois,
      status: "error",
      error,
    };
  }

  return {
    pois,
    status: pois.length > 0 ? "ready" : "loading",
    error: null,
  };
}
