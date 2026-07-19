import seedData from "@/lib/poi/pois.json";
import type { POI } from "@/types";

export const LICENSED_POI_SEED = seedData as POI[];

export async function loadBundledLicensedPOIs() {
  return LICENSED_POI_SEED;
}
