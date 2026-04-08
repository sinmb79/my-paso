import seedData from "@/lib/poi/pois-dummy.json";
import type { POI } from "@/types";

export const DUMMY_POI_SEED = seedData as POI[];

export async function loadBundledDummyPOIs() {
  return DUMMY_POI_SEED;
}
