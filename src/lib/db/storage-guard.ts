import type { PasoDatabase } from "@/types";

export class VolatileStorageError extends Error {
  constructor() {
    super(
      "Persistent storage is unavailable. Your records would be lost when the app closes.",
    );
    this.name = "VolatileStorageError";
  }
}

export function canWriteDurably(database: Pick<PasoDatabase, "storageMode">) {
  return database.storageMode === "indexeddb";
}

export function assertDurableStorage(
  database: Pick<PasoDatabase, "storageMode">,
) {
  if (!canWriteDurably(database)) {
    throw new VolatileStorageError();
  }
}
