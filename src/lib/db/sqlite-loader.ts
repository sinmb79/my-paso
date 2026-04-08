import { withBasePath } from "@/lib/config/site";

const WASM_BINARY_URL = withBasePath("/vendor/wa-sqlite-async.wasm");

type SQLiteModuleConfig = {
  locateFile?: (fileName: string) => string;
  wasmBinary?: Uint8Array;
};

type SQLiteFactoryModule = {
  default: (config?: SQLiteModuleConfig) => Promise<unknown>;
};

export async function createSQLiteModule() {
  const runtimeImport = new Function(
    "moduleSpecifier",
    "return import(moduleSpecifier);",
  ) as (moduleSpecifier: string) => Promise<SQLiteFactoryModule>;

  const { default: loadSQLiteModule } = await runtimeImport(
    withBasePath("/vendor/wa-sqlite-async.mjs"),
  );

  return loadSQLiteModule({
    locateFile(fileName) {
      if (fileName === "wa-sqlite-async.wasm") {
        return WASM_BINARY_URL;
      }

      return fileName;
    },
  });
}
