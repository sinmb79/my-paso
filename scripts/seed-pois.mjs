import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_OUTPUT = "tests/fixtures/pois-dummy.json";
const DEFAULT_WIKIDATA_OUTPUT = "src/lib/poi/pois.json";
const DEFAULT_WIKIDATA_MANIFEST = "src/lib/poi/seed-manifest.json";
const DEFAULT_COUNT = 100;
const DEFAULT_TOUR_URL = process.env.TOUR_API_URL ?? "";
const DEFAULT_HERITAGE_URL = process.env.HERITAGE_API_URL ?? "";
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIDATA_LICENSE = {
  id: "CC0-1.0",
  name: "CC0 1.0 Universal",
  url: "https://creativecommons.org/publicdomain/zero/1.0/",
  policy_url: "https://www.wikidata.org/wiki/Wikidata:Licensing",
};
const WIKIDATA_SEED_VERSION = "wikidata-ko-2026-07-19-v1";
const WIKIDATA_CATEGORY_SPECS = [
  {
    category: "cultural_heritage",
    typeQuotas: { Q9259: 4, Q16560: 8, Q44539: 8 },
  },
  { category: "historic_site", typeQuotas: { Q839954: 20 } },
  {
    category: "tourist_attraction",
    typeQuotas: {
      Q194195: 4,
      Q2281788: 2,
      Q1440300: 1,
      Q33506: 13,
    },
  },
  {
    category: "nature",
    typeQuotas: { Q46169: 10, Q40080: 3, Q34038: 3, Q23397: 2, Q35509: 2 },
  },
  { category: "food", typeQuotas: { Q11707: 10 } },
  { category: "community", typeQuotas: { Q174782: 2, Q37654: 3, Q7075: 5 } },
];
const WIKIDATA_EXCLUDED_QIDS = new Set([
  // Seokguram is a cultural grotto, not a general-purpose nature destination.
  "Q489820",
  // Prefer the dedicated Seoul Amsa-dong Site entity over the broader Amsa-dong label.
  "Q2647314",
]);
const CATEGORIES = [
  "cultural_heritage",
  "historic_site",
  "tourist_attraction",
  "nature",
  "food",
  "community",
];
const CATEGORY_LABELS = {
  cultural_heritage: "문화유산",
  historic_site: "역사유적",
  tourist_attraction: "관광명소",
  nature: "자연명소",
  food: "미식장소",
  community: "커뮤니티",
};
const REGIONS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "강원",
  "제주",
];
const DISTRICTS = [
  "종로",
  "중구",
  "용산",
  "성동",
  "마포",
  "서대문",
  "송파",
  "강남",
  "영등포",
  "수원",
  "용인",
  "고양",
  "인천 중구",
  "해운대",
  "춘천",
  "제주시",
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
    const category = CATEGORIES[index % CATEGORIES.length];

    return {
      id: `dummy-poi-${sequence}`,
      name: `테스트 ${CATEGORY_LABELS[category]} ${String(sequence).padStart(2, "0")}`,
      description: `로컬 퍼스트 지도와 방문 기록 기능을 검증하기 위한 테스트 장소 ${String(sequence).padStart(2, "0")}입니다.`,
      category,
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

function entityId(value) {
  return String(value ?? "").replace(/^.*\//, "");
}

function parseWikidataPoint(value) {
  const match = /^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(
    String(value ?? ""),
  );
  if (!match) {
    return null;
  }

  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 32.8 ||
    latitude > 38.7 ||
    longitude < 124.5 ||
    longitude > 132
  ) {
    return null;
  }

  return { latitude, longitude };
}

function qidNumber(value) {
  return Number(String(value).replace(/^Q/, ""));
}

function compareWikidataCandidates(left, right) {
  return (
    right.sitelinks - left.sitelinks ||
    qidNumber(left.qid) - qidNumber(right.qid) ||
    left.typeQid.localeCompare(right.typeQid) ||
    left.coordinate.localeCompare(right.coordinate)
  );
}

function normalizedPlaceName(value) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function approximateDistanceMeters(left, right) {
  const latitudeMeters = (left.latitude - right.latitude) * 111_320;
  const longitudeMeters =
    (left.longitude - right.longitude) *
    111_320 *
    Math.cos((left.latitude * Math.PI) / 180);
  return Math.hypot(latitudeMeters, longitudeMeters);
}

async function fetchSparql(query) {
  const response = await fetch(WIKIDATA_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "MyPaso/0.2.0 (local release engineering)",
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload?.results?.bindings ?? [];
}

function buildWikidataCandidateQuery() {
  const typeValues = Array.from(
    new Set(
      WIKIDATA_CATEGORY_SPECS.flatMap((spec) => Object.keys(spec.typeQuotas)),
    ),
  )
    .map((qid) => `wd:${qid}`)
    .join(" ");

  return `SELECT DISTINCT ?item ?itemLabel ?coord ?type ?typeLabel ?sitelinks WHERE {
  VALUES ?type { ${typeValues} }
  ?item wdt:P31 ?type;
        wdt:P625 ?coord;
        wdt:P17 wd:Q884.
  OPTIONAL { ?item wikibase:sitelinks ?rawSitelinks. }
  BIND(COALESCE(?rawSitelinks, 0) AS ?sitelinks)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
}
ORDER BY DESC(?sitelinks) ?item ?type ?coord`;
}

function normalizeWikidataCandidate(binding) {
  const qid = entityId(binding.item?.value);
  const typeQid = entityId(binding.type?.value);
  const coordinate = binding.coord?.value ?? "";
  const point = parseWikidataPoint(coordinate);
  const name = asString(binding.itemLabel?.value);
  const typeLabel = asString(binding.typeLabel?.value, typeQid);

  if (
    !/^Q\d+$/.test(qid) ||
    !/^Q\d+$/.test(typeQid) ||
    !point ||
    !name ||
    name === qid ||
    WIKIDATA_EXCLUDED_QIDS.has(qid)
  ) {
    return null;
  }

  return {
    qid,
    typeQid,
    typeLabel,
    name,
    coordinate,
    latitude: point.latitude,
    longitude: point.longitude,
    sitelinks: asNumber(binding.sitelinks?.value, 0),
  };
}

function selectWikidataCandidates(candidates) {
  const sorted = candidates.slice().sort(compareWikidataCandidates);
  const selected = [];
  const selectedQids = new Set();
  const selectedNames = new Set();

  const isAvailable = (candidate) =>
    !selectedQids.has(candidate.qid) &&
    !selectedNames.has(normalizedPlaceName(candidate.name)) &&
    selected.every((current) => approximateDistanceMeters(current, candidate) >= 25);

  const addFromPool = (pool, count, category) => {
    const seenQids = new Set();
    let added = 0;
    for (const candidate of pool) {
      if (seenQids.has(candidate.qid)) {
        continue;
      }
      seenQids.add(candidate.qid);
      if (!isAvailable(candidate)) {
        continue;
      }
      selectedQids.add(candidate.qid);
      selectedNames.add(normalizedPlaceName(candidate.name));
      selected.push({ ...candidate, category });
      added += 1;
      if (added === count) {
        break;
      }
    }
    return added;
  };

  for (const spec of WIKIDATA_CATEGORY_SPECS) {
    const categoryStart = selected.length;
    for (const [typeQid, quota] of Object.entries(spec.typeQuotas)) {
      addFromPool(
        sorted.filter((candidate) => candidate.typeQid === typeQid),
        quota,
        spec.category,
      );
    }

    const categoryTarget = Object.values(spec.typeQuotas).reduce(
      (total, quota) => total + quota,
      0,
    );
    const selectedForCategory = selected.length - categoryStart;
    if (selectedForCategory < categoryTarget) {
      const approvedTypes = new Set(Object.keys(spec.typeQuotas));
      addFromPool(
        sorted.filter((candidate) => approvedTypes.has(candidate.typeQid)),
        categoryTarget - selectedForCategory,
        spec.category,
      );
    }

    if (selected.length - categoryStart !== categoryTarget) {
      throw new Error(
        `Wikidata did not provide enough approved ${spec.category} candidates.`,
      );
    }
  }

  if (selected.length !== DEFAULT_COUNT || selectedQids.size !== DEFAULT_COUNT) {
    throw new Error(
      `Wikidata selection must contain exactly ${DEFAULT_COUNT} unique places; got ${selected.length}.`,
    );
  }

  return selected;
}

function buildWikidataAdminQuery(qids) {
  const items = qids.map((qid) => `wd:${qid}`).join(" ");
  return `SELECT ?item ?district ?districtLabel ?region ?regionLabel WHERE {
  VALUES ?item { ${items} }
  OPTIONAL { ?item wdt:P131 ?district. }
  OPTIONAL {
    VALUES ?region {
      wd:Q8684 wd:Q16520 wd:Q20921 wd:Q20927 wd:Q20929 wd:Q20934
      wd:Q20937 wd:Q41066 wd:Q41070 wd:Q41071 wd:Q41151 wd:Q41154
      wd:Q41157 wd:Q41161 wd:Q41164 wd:Q41278 wd:Q41283
    }
    ?item wdt:P131* ?region.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
}
ORDER BY ?item ?region ?district`;
}

function createAdminLookup(bindings) {
  const lookup = new Map();
  for (const binding of bindings) {
    const qid = entityId(binding.item?.value);
    if (!lookup.has(qid)) {
      lookup.set(qid, {
        district: asString(binding.districtLabel?.value),
        districtQid: entityId(binding.district?.value),
        region: asString(binding.regionLabel?.value),
        regionQid: entityId(binding.region?.value),
      });
    }
  }
  return lookup;
}

function createLicensedWikidataPois(selected, adminLookup) {
  const baseXp = {
    cultural_heritage: 14,
    historic_site: 13,
    tourist_attraction: 12,
    nature: 12,
    food: 10,
    community: 10,
  };

  return selected.map((candidate) => {
    const admin = adminLookup.get(candidate.qid);
    const region = admin?.region && admin.region !== admin.regionQid
      ? admin.region
      : "대한민국";
    const district = admin?.district && admin.district !== admin.districtQid
      ? admin.district
      : "행정구역 미확인";

    return {
      id: `wikidata-${candidate.qid}`,
      name: candidate.name,
      description: `${candidate.typeLabel} · Wikidata CC0 스냅샷`,
      category: candidate.category,
      latitude: Number(candidate.latitude.toFixed(6)),
      longitude: Number(candidate.longitude.toFixed(6)),
      geofence_radius_m: 100,
      region,
      district,
      source: `wikidata:${candidate.qid}`,
      base_xp: baseXp[candidate.category],
    };
  });
}

function writeJsonFile(outputFile, value) {
  const absolutePath = resolve(process.cwd(), outputFile);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, payload, "utf8");
  return { absolutePath, payload };
}

async function generateWikidataSeed({ output, manifestOutput, snapshotDate }) {
  const candidateQuery = buildWikidataCandidateQuery();
  const bindings = await fetchSparql(candidateQuery);
  const candidates = bindings.map(normalizeWikidataCandidate).filter(Boolean);
  const selected = selectWikidataCandidates(candidates);
  const adminQuery = buildWikidataAdminQuery(selected.map((item) => item.qid));
  const adminBindings = await fetchSparql(adminQuery);
  const adminLookup = createAdminLookup(adminBindings);
  const pois = createLicensedWikidataPois(selected, adminLookup);
  const seedWrite = writeJsonFile(output, pois);
  const seedHash = createHash("sha256").update(seedWrite.payload).digest("hex");
  const generatedAt = new Date().toISOString();
  const manifest = {
    schema_version: 1,
    seed_version: WIKIDATA_SEED_VERSION,
    generated_at: generatedAt,
    data_as_of: snapshotDate,
    record_count: pois.length,
    seed_sha256: seedHash,
    source: {
      name: "Wikidata",
      homepage: "https://www.wikidata.org/",
      query_endpoint: WIKIDATA_ENDPOINT,
      license: WIKIDATA_LICENSE,
      query_text: candidateQuery,
      admin_query_text: adminQuery,
    },
    selection: {
      country_qid: "Q884",
      sort: "descending sitelink count, then numeric QID",
      category_type_quotas: Object.fromEntries(
        WIKIDATA_CATEGORY_SPECS.map((spec) => [spec.category, spec.typeQuotas]),
      ),
      excluded_qids: Array.from(WIKIDATA_EXCLUDED_QIDS),
    },
    coordinate_policy: {
      property: "P625",
      geofence_radius_m: 100,
      review_status: "structured-data snapshot; entrance points not independently verified",
    },
    records: selected.map((candidate, index) => {
      const admin = adminLookup.get(candidate.qid);
      return {
        id: pois[index].id,
        qid: candidate.qid,
        name: candidate.name,
        category: candidate.category,
        type_qid: candidate.typeQid,
        type_label: candidate.typeLabel,
        latitude: pois[index].latitude,
        longitude: pois[index].longitude,
        region_qid: admin?.regionQid || null,
        district_qid: admin?.districtQid || null,
        entity_url: `https://www.wikidata.org/entity/${candidate.qid}`,
      };
    }),
  };
  const manifestWrite = writeJsonFile(manifestOutput, manifest);

  return {
    pois,
    outputPath: seedWrite.absolutePath,
    manifestPath: manifestWrite.absolutePath,
  };
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
  const output =
    args.output ?? (mode === "wikidata" ? DEFAULT_WIKIDATA_OUTPUT : DEFAULT_OUTPUT);
  const manifestOutput = args["manifest-output"] ?? DEFAULT_WIKIDATA_MANIFEST;
  const tourUrl = args["tour-url"] ?? DEFAULT_TOUR_URL;
  const heritageUrl = args["heritage-url"] ?? DEFAULT_HERITAGE_URL;
  const tourKey = args["tour-key"] ?? process.env.TOUR_API_KEY ?? "";
  const heritageKey =
    args["heritage-key"] ?? process.env.CHA_API_KEY ?? process.env.HERITAGE_API_KEY ?? "";

  if (mode === "wikidata") {
    if (count !== DEFAULT_COUNT) {
      throw new Error(`Wikidata release seed count is fixed at ${DEFAULT_COUNT}.`);
    }
    const result = await generateWikidataSeed({
      output,
      manifestOutput,
      snapshotDate: args["snapshot-date"] ?? "2026-07-19",
    });
    process.stdout.write(
      `seed-pois: wrote ${result.pois.length} licensed POIs to ${result.outputPath} and ${result.manifestPath} (wikidata)\n`,
    );
    return;
  }

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
