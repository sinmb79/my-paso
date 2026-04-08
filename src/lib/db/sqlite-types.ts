export type SQLiteValue =
  | number
  | string
  | bigint
  | Uint8Array
  | null;

export type SQLiteBindings =
  | SQLiteValue[]
  | Record<string, SQLiteValue>
  | undefined
  | null;

export interface SQLiteExecResult {
  columns: string[];
  rows: SQLiteValue[][];
}

export interface SQLiteAPI {
  close(db: number): Promise<number>;
  exec(
    db: number,
    sql: string,
    callback?: (row: SQLiteValue[], columns: string[]) => unknown,
  ): Promise<number>;
  execWithParams(
    db: number,
    sql: string,
    params?: SQLiteBindings,
  ): Promise<SQLiteExecResult>;
  executeBatch(
    db: number,
    sqlQueries: string[],
    params?: SQLiteBindings[],
  ): Promise<number | undefined>;
  open_v2(zFilename: string, flags: number, zVfs: string): Promise<number>;
  vfs_register(vfs: unknown, makeDefault: boolean): number;
}
