import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type SQLiteModuleConfig = {
  locateFile?: (fileName: string) => string;
  wasmBinary?: Uint8Array;
};

type SQLiteFactoryModule = {
  default: (config?: SQLiteModuleConfig) => Promise<unknown>;
};

export async function createSQLiteModule() {
  const projectRoot = process.cwd();
  const modulePath = resolve(projectRoot, "public/vendor/wa-sqlite-async.mjs");
  const wasmPath = resolve(projectRoot, "public/vendor/wa-sqlite-async.wasm");
  const wasmBinary = await readFile(wasmPath);
  const moduleSpecifier = pathToFileURL(modulePath).href;
  const { default: loadSQLiteModule } = (await import(
    /* @vite-ignore */ moduleSpecifier
  )) as SQLiteFactoryModule;

  return loadSQLiteModule({ wasmBinary });
}
