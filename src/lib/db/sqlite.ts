import * as SQLite from "@/lib/db/vendor/wa-sqlite/sqlite-api.js";
import { IDBMinimalVFS } from "@/lib/db/vendor/wa-sqlite/examples/IDBMinimalVFS.js";
import { MemoryVFS } from "@/lib/db/vendor/wa-sqlite/examples/MemoryVFS.js";
import { createSQLiteModule } from "@/lib/db/sqlite-loader";
import type { SQLiteAPI } from "@/lib/db/sqlite-types";

import { runMigrations } from "@/lib/db/migrations";
import type {
  DatabaseOptions,
  DatabaseStorageMode,
  PasoDatabase,
} from "@/types";

const DEFAULT_DATABASE_NAME = "paso-local.db";
let sqlitePromise: Promise<SQLiteAPI> | null = null;
const connectionCache = new Map<string, Promise<PasoDatabase>>();
const registeredVfs = new Map<string, IDBMinimalVFS | MemoryVFS>();
const vfsVersions = new Map<string, number>();

function canUseIndexedDBStorage() {
  return (
    typeof indexedDB !== "undefined" &&
    typeof navigator !== "undefined" &&
    "locks" in navigator
  );
}

function sanitizeDatabaseName(databaseName: string) {
  return databaseName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function getStorageMode(persistent: boolean): DatabaseStorageMode {
  if (process.env.NODE_ENV === "test") {
    return "memory";
  }

  return persistent && canUseIndexedDBStorage() ? "indexeddb" : "memory";
}

function getCacheKey(databaseName: string, persistent: boolean) {
  return `${getStorageMode(persistent)}:${databaseName}`;
}

function getVfsName(databaseName: string, storageMode: DatabaseStorageMode) {
  const versionKey = `${storageMode}:${databaseName}`;
  const currentVersion = vfsVersions.get(versionKey) ?? 0;

  return `paso-${storageMode}-${sanitizeDatabaseName(databaseName)}-${currentVersion}`;
}

async function getSQLiteApi() {
  if (process.env.NODE_ENV === "test") {
    const sqliteModule = await createSQLiteModule();
    return SQLite.Factory(sqliteModule);
  }

  if (!sqlitePromise) {
    sqlitePromise = (async () => {
      const sqliteModule = await createSQLiteModule();
      return SQLite.Factory(sqliteModule);
    })();
  }

  return sqlitePromise;
}

async function ensureVfs(
  sqlite3: SQLiteAPI,
  databaseName: string,
  storageMode: DatabaseStorageMode,
) {
  const key = `${storageMode}:${databaseName}`;
  const existing = registeredVfs.get(key);

  if (existing) {
    return existing;
  }

  const vfs =
    storageMode === "indexeddb"
      ? new IDBMinimalVFS(databaseName)
      : new MemoryVFS();

  vfs.name = getVfsName(databaseName, storageMode);
  sqlite3.vfs_register(vfs, false);
  registeredVfs.set(key, vfs);

  return vfs;
}

async function openDatabase({
  databaseName = DEFAULT_DATABASE_NAME,
  persistent = true,
}: DatabaseOptions = {}): Promise<PasoDatabase> {
  const sqlite3 = await getSQLiteApi();
  const storageMode = getStorageMode(persistent);
  const vfs = await ensureVfs(sqlite3, databaseName, storageMode);
  const db = await sqlite3.open_v2(
    databaseName,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    vfs.name,
  );

  await runMigrations(sqlite3, db);

  return {
    sqlite3,
    db,
    databaseName,
    storageMode,
    close: async () => {
      await sqlite3.close(db);
    },
  };
}

export async function initializeDatabase(options: DatabaseOptions = {}) {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  const persistent = options.persistent ?? true;
  const key = getCacheKey(databaseName, persistent);

  if (!connectionCache.has(key)) {
    connectionCache.set(key, openDatabase({ databaseName, persistent }));
  }

  return connectionCache.get(key)!;
}

function deleteIndexedDatabase(databaseName: string) {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.addEventListener("success", () => resolve());
    request.addEventListener("blocked", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function destroyDatabase(databaseName = DEFAULT_DATABASE_NAME) {
  const keys = [`memory:${databaseName}`, `indexeddb:${databaseName}`];

  for (const key of keys) {
    const cachedConnection = connectionCache.get(key);
    if (cachedConnection) {
      const database = await cachedConnection.catch(() => null);
      if (database) {
        await database.close().catch(() => undefined);
      }
      connectionCache.delete(key);
    }
  }

  const memoryKey = `memory:${databaseName}`;
  const memoryVfs = registeredVfs.get(memoryKey);
  if (memoryVfs) {
    memoryVfs.xDelete(databaseName, 0);
    await Promise.resolve(memoryVfs.close()).catch(() => undefined);
    registeredVfs.delete(memoryKey);
    vfsVersions.set(memoryKey, (vfsVersions.get(memoryKey) ?? 0) + 1);
  }

  const indexedDbKey = `indexeddb:${databaseName}`;
  const indexedDbVfs = registeredVfs.get(indexedDbKey);
  if (indexedDbVfs) {
    await Promise.resolve(indexedDbVfs.close()).catch(() => undefined);
    registeredVfs.delete(indexedDbKey);
    vfsVersions.set(
      indexedDbKey,
      (vfsVersions.get(indexedDbKey) ?? 0) + 1,
    );
  }

  await deleteIndexedDatabase(databaseName).catch(() => undefined);
}
