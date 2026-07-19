import { assertDurableStorage, canWriteDurably } from "@/lib/db/storage-guard";
import type { PasoDatabase } from "@/types";

function createDatabase(storageMode: PasoDatabase["storageMode"]) {
  return { storageMode } as PasoDatabase;
}

describe("durable storage guard", () => {
  it("allows writes when IndexedDB-backed SQLite is active", () => {
    const database = createDatabase("indexeddb");

    expect(canWriteDurably(database)).toBe(true);
    expect(() => assertDurableStorage(database)).not.toThrow();
  });

  it("blocks writes when SQLite has fallen back to volatile memory", () => {
    const database = createDatabase("memory");

    expect(canWriteDurably(database)).toBe(false);
    expect(() => assertDurableStorage(database)).toThrow(
      "Persistent storage is unavailable",
    );
  });
});
