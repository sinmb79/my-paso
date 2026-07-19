import type { SQLiteBindings } from "@/lib/db/sqlite-types";
import type { PasoDatabase } from "@/types";

export async function executeStatementsOrThrow(
  database: PasoDatabase,
  statement: string,
  rows: SQLiteBindings[],
) {
  for (const bindings of rows) {
    await database.sqlite3.execWithParams(database.db, statement, bindings);
  }
}

export async function withImmediateTransaction<T>(
  database: PasoDatabase,
  operation: () => Promise<T>,
) {
  await database.sqlite3.exec(database.db, "BEGIN IMMEDIATE;");

  try {
    const result = await operation();
    await database.sqlite3.exec(database.db, "COMMIT;");
    return result;
  } catch (error) {
    try {
      await database.sqlite3.exec(database.db, "ROLLBACK;");
    } catch {
      // Preserve the original failure; rollback errors are secondary evidence.
    }
    throw error;
  }
}
