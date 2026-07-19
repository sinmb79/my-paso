import { insertPOIs } from "@/lib/db/queries";
import { loadBundledLicensedPOIs } from "@/lib/poi/licensed-seed";
import type { PasoDatabase } from "@/types";

export async function loadSeedPOIs(database: PasoDatabase) {
  const licensedSeed = await loadBundledLicensedPOIs();
  await insertPOIs(database, licensedSeed);

  return licensedSeed.length;
}
