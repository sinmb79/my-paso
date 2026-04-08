import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_OUTPUT = "src/lib/poi/pois-dummy.json";
const DEFAULT_COUNT = 100;
const DEFAULT_TOUR_URL = process.env.TOUR_API_URL ?? "";
const DEFAULT_HERITAGE_URL = process.env.HERITAGE_API_URL ?? "";
const CATEGORIES = [
  "cultural_heritage",
  "historic_site",
  "tourist_attraction",
  "nature",
  "food",
  "community",
];
const REGIONS = [
  "Seoul",
  "Gyeonggi",
  "Incheon",
  "Busan",
  "Gangwon",
  "Jeju",
];
const DISTRICTS = [
  "Jongno",
  "Jung",
  "Yongsan",
  "Seongdong",
  "Mapo",
  "Seodaemun",
  "Songpa",
  "Gangnam",
  "Yeongdeungpo",
  "Suwon",
  "Yongin",
  "Goyang",
  "Incheon Jung",
  "Haeundae",
  "Chuncheon",
  "Jeju City",
];

function parseArgs(argv) {
  const args = {};

  for (const token of argv) {
    if (!token.startsWith("--")) {
      continue;
    }

    const [key, value] = token.slice(2).split("=", 2);
    args[key] = value ?? "true";
  }

  return args;
}

function asNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inferCategory(record) {
  const haystack = [
    record.category,
    record.contenttypeid,
    record.contentTypeId,
    record.cat1,
    record.cat2,
    record.cat3,
    record.type,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  if (haystack.includes("food")) {
    return "food";
  }

  if (haystack.includes("nature") || haystack.includes("mountain")) {
    return "nature";
  }

  if (haystack.includes("community")) {
    return "community";
  }

  if (haystack.includes("historic")) {
    return "historic_site";
  }

  if (haystack.includes("heritage") || haystack.includes("cultural")) {
    return "cultural_heritage";
  }

  return "tourist_attraction";
}

function createDummyPois(count = DEFAULT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const row = Math.floor(index / 10);
    const col = index % 10;

    return {
      id: `dummy-poi-${sequence}`,
      name: `Dummy POI ${sequence}`,
      description: `Bundled placeholder point of interest #${sequence} for local-first map shell testing.`,
      category: CATEGORIES[index % CATEGORIES.length],
      latitude: Number((37.45 + row * 0.025 + (col % 2) * 0.0025).toFixed(6)),
      longitude: Number((126.82 + col * 0.03 + row * 0.004).toFixed(6)),
      geofence_radius_m: 50,
      region: REGIONS[index % REGIONS.length],
      district: DISTRICTS[index % DISTRICTS.length],
      source: "dummy",
      base_xp: 10 + (index % 5),
    };
  });
}

function normalizeExternalPoi(record, source, index) {
  const name = asString(
    record.name,
    record.title,
    record.poi_name,
    record.contenttitle,
    record.ccbaMnm1,
    record.addr1,
  );
  const latitude = asNumber(
    record.latitude ?? record.lat ?? record.mapy ?? record.gpsy ?? record.y,
    Number.NaN,
  );
  const longitude = asNumber(
    record.longitude ?? record.lng ?? record.mapx ?? record.gpsx ?? record.x,
    Number.NaN,
  );

  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const region = asString(record.region, record.areaName, record.sido, record.addr1) || "Korea";
  const district =
    asString(record.district, record.sigungu, record.addr2, record.gugun) ||
    "Unspecified";
  const description = asString(
    record.description,
    record.overview,
    record.summary,
    record.ccbaLcad,
  );
  const idBase = asString(
    record.id,
    record.contentid,
    record.ccbaKdcd,
    record.ccbaAsno,
    `${source}-${index + 1}`,
  );

  return {
    id: `${slugify(source)}-${slugify(idBase || `${index + 1}`)}`,
    name,
    description: description || `${name} imported from ${source}.`,
    category: inferCategory(record),
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    geofence_radius_m: 50,
    region,
    district,
    source,
    base_xp: 12,
  };
}

function dedupePois(pois) {
  const unique = new Map();

  for (const poi of pois) {
    const key = [
      poi.name.toLowerCase(),
      poi.latitude.toFixed(4),
      poi.longitude.toFixed(4),
    ].join(":");

    if (!unique.has(key)) {
      unique.set(key, poi);
    }
  }

  return Array.from(unique.values());
}

function loadJsonArray(filePath, sourceLabel) {
  if (!filePath) {
    return [];
  }

  const absolutePath = resolve(process.cwd(), filePath);
  const payload = JSON.parse(readFileSync(absolutePath, "utf8"));

  if (!Array.isArray(payload)) {
    throw new Error(`${sourceLabel} input must be a JSON array: ${absolutePath}`);
  }

  return payload;
}

function getArrayFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return (
    payload?.response?.body?.items?.item ??
    payload?.items?.item ??
    payload?.items ??
    payload?.data ??
    []
  );
}

function createMergePois({ tour, heritage, count }) {
  const tourRecords = loadJsonArray(tour, "tour");
  const heritageRecords = loadJsonArray(heritage, "heritage");
  const normalized = [
    ...tourRecords
      .map((record, index) => normalizeExternalPoi(record, "tourapi", index))
      .filter(Boolean),
    ...heritageRecords
      .map((record, index) => normalizeExternalPoi(record, "heritage", index))
      .filter(Boolean),
  ];

  if (normalized.length === 0) {
    throw new Error(
      "Merge mode did not receive any usable records. Provide --tour and/or --heritage JSON exports.",
    );
  }

  return dedupePois(normalized).slice(0, count);
}

async function fetchJson(url, params = {}) {
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue;
    }

    requestUrl.searchParams.set(key, String(value));
  }

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${requestUrl}: ${response.status}`);
  }

  return response.json();
}

async function fetchLivePois({
  tourUrl,
  heritageUrl,
  tourKey,
  heritageKey,
  count,
}) {
  const normalized = [];

  if (tourUrl) {
    const payload = await fetchJson(tourUrl, {
      serviceKey: tourKey,
      MobileOS: "ETC",
      MobileApp: "MyPaso",
      _type: "json",
      numOfRows: count,
      pageNo: 1,
    });
    const records = getArrayFromPayload(payload);
    normalized.push(
      ...records
        .map((record, index) => normalizeExternalPoi(record, "tourapi", index))
        .filter(Boolean),
    );
  }

  if (heritageUrl) {
    const payload = await fetchJson(heritageUrl, {
      serviceKey: heritageKey,
      numOfRows: count,
      pageNo: 1,
    });
    const records = getArrayFromPayload(payload);
    normalized.push(
      ...records
        .map((record, index) => normalizeExternalPoi(record, "heritage", index))
        .filter(Boolean),
    );
  }

  if (normalized.length === 0) {
    throw new Error(
      "Live mode requires at least one working endpoint via --tour-url or --heritage-url.",
    );
  }

  return dedupePois(normalized).slice(0, count);
}

function writeSeedFile(outputFile, pois) {
  const absolutePath = resolve(process.cwd(), outputFile);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(pois, null, 2)}\n`, "utf8");
  return absolutePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode ?? "dummy";
  const count = asNumber(args.count, DEFAULT_COUNT);
  const output = args.output ?? DEFAULT_OUTPUT;
  const tourUrl = args["tour-url"] ?? DEFAULT_TOUR_URL;
  const heritageUrl = args["heritage-url"] ?? DEFAULT_HERITAGE_URL;
  const tourKey = args["tour-key"] ?? process.env.TOUR_API_KEY ?? "";
  const heritageKey =
    args["heritage-key"] ?? process.env.CHA_API_KEY ?? process.env.HERITAGE_API_KEY ?? "";

  const pois = await (mode === "merge"
      ? createMergePois({
          tour: args.tour,
          heritage: args.heritage,
          count,
        })
      : mode === "live"
        ? fetchLivePois({
            tourUrl,
            heritageUrl,
            tourKey,
            heritageKey,
            count,
          })
        : createDummyPois(count));

  const absolutePath = writeSeedFile(output, pois);

  process.stdout.write(
    `seed-pois: wrote ${pois.length} POIs to ${absolutePath} (${mode})\n`,
  );
}

await main();
