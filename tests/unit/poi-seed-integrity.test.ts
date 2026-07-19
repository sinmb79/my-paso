import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import seedManifest from "@/lib/poi/seed-manifest.json";
import seedData from "@/lib/poi/pois.json";

describe("licensed POI seed", () => {
  it("contains exactly 100 unique, real South Korean places", () => {
    expect(seedData).toHaveLength(100);
    expect(new Set(seedData.map((poi) => poi.id)).size).toBe(100);
    expect(new Set(seedData.map((poi) => poi.name.trim().toLocaleLowerCase())).size).toBe(
      100,
    );
    expect(
      seedData.every(
        (poi) =>
          /^wikidata-Q\d+$/.test(poi.id) &&
          poi.source === poi.id.replace("wikidata-", "wikidata:") &&
          !/테스트|dummy/i.test(`${poi.name} ${poi.description ?? ""}`) &&
          poi.latitude >= 32.8 &&
          poi.latitude <= 38.7 &&
          poi.longitude >= 124.5 &&
          poi.longitude <= 132.0,
      ),
    ).toBe(true);

    for (const [index, poi] of seedData.entries()) {
      for (const other of seedData.slice(index + 1)) {
        const latitudeMeters = (poi.latitude - other.latitude) * 111_320;
        const longitudeMeters =
          (poi.longitude - other.longitude) *
          111_320 *
          Math.cos((poi.latitude * Math.PI) / 180);
        expect(Math.hypot(latitudeMeters, longitudeMeters)).toBeGreaterThanOrEqual(
          25,
        );
      }
    }

    const categoryCounts = Object.fromEntries(
      Object.entries(
        seedData.reduce<Record<string, number>>((counts, poi) => {
          counts[poi.category] = (counts[poi.category] ?? 0) + 1;
          return counts;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right)),
    );
    expect(categoryCounts).toEqual({
      community: 10,
      cultural_heritage: 20,
      food: 10,
      historic_site: 20,
      nature: 20,
      tourist_attraction: 20,
    });
  });

  it("ships a matching CC0 provenance manifest", () => {
    const seedPath = join(process.cwd(), "src", "lib", "poi", "pois.json");
    const seedHash = createHash("sha256")
      .update(readFileSync(seedPath))
      .digest("hex");

    expect(seedManifest).toMatchObject({
      schema_version: 1,
      seed_version: "wikidata-ko-2026-07-19-v1",
      record_count: 100,
      seed_sha256: seedHash,
      source: {
        name: "Wikidata",
        query_endpoint: "https://query.wikidata.org/sparql",
        license: {
          id: "CC0-1.0",
          url: "https://creativecommons.org/publicdomain/zero/1.0/",
        },
      },
    });
    expect(seedManifest.records).toHaveLength(100);
    expect(new Set(seedManifest.records.map((record) => record.qid)).size).toBe(
      100,
    );
    expect(
      seedManifest.records.map((record) => ({
        id: record.id,
        name: record.name,
        category: record.category,
        latitude: record.latitude,
        longitude: record.longitude,
      })),
    ).toEqual(
      seedData.map((poi) => ({
        id: poi.id,
        name: poi.name,
        category: poi.category,
        latitude: poi.latitude,
        longitude: poi.longitude,
      })),
    );
    expect(
      seedManifest.records.every(
        (record) =>
          record.id === `wikidata-${record.qid}` &&
          record.entity_url ===
            `https://www.wikidata.org/entity/${record.qid}`,
      ),
    ).toBe(true);
  });
});
