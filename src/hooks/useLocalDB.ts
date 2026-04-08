"use client";

import { useEffect, useState } from "react";

import { initializeDatabase } from "@/lib/db/sqlite";
import type { DatabaseOptions, PasoDatabase } from "@/types";

type LocalDatabaseState =
  | { status: "loading"; database: null; error: null }
  | { status: "ready"; database: PasoDatabase; error: null }
  | { status: "error"; database: null; error: Error };

export function useLocalDB(options?: DatabaseOptions): LocalDatabaseState {
  const databaseName = options?.databaseName;
  const persistent = options?.persistent ?? true;
  const [state, setState] = useState<LocalDatabaseState>({
    status: "loading",
    database: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    initializeDatabase({ databaseName, persistent })
      .then((database) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          database,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          database: null,
          error:
            error instanceof Error
              ? error
              : new Error("Failed to initialize the local database."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [databaseName, persistent]);

  return state;
}
