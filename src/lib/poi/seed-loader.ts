import { countPOIs, insertPOIs } from "@/lib/db/queries";
import { loadBundledDummyPOIs } from "@/lib/poi/dummy-seed";
import type { PasoDatabase } from "@/types";

export async function loadSeedPOIs(database: PasoDatabase) {
  const existingCount = await countPOIs(database);
  if (existingCount > 0) {
    return 0;
  }

  const dummySeed = await loadBundledDummyPOIs();
  await insertPOIs(database, dummySeed);

  return dummySeed.length;
}
