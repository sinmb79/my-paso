import { deriveLevel, calculateReviewXP, calculateVisitXP } from "@/lib/xp/xp-engine";
import { withImmediateTransaction } from "@/lib/db/transaction";

import type {
  CreateReviewInput,
  CreateVisitInput,
  PasoDatabase,
  POI,
  PlaceSummary,
  Profile,
  Review,
  Stats,
  Visit,
  XPBreakdown,
} from "@/types";

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function asString(value: unknown) {
  return String(value ?? "");
}

function asOptionalString(value: unknown) {
  return value == null ? undefined : String(value);
}

function asStringArray(value: unknown) {
  if (typeof value !== "string" || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function asXPBreakdown(value: unknown): XPBreakdown {
  if (typeof value !== "string" || !value) {
    return {
      base_visit: 0,
      first_visit_bonus: 0,
      review_bonus: 0,
      photo_bonus: 0,
      streak_bonus: 0,
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<XPBreakdown>;
    return {
      base_visit: Number(parsed.base_visit ?? 0),
      first_visit_bonus: Number(parsed.first_visit_bonus ?? 0),
      review_bonus: Number(parsed.review_bonus ?? 0),
      photo_bonus: Number(parsed.photo_bonus ?? 0),
      streak_bonus: Number(parsed.streak_bonus ?? 0),
    };
  } catch {
    return {
      base_visit: 0,
      first_visit_bonus: 0,
      review_bonus: 0,
      photo_bonus: 0,
      streak_bonus: 0,
    };
  }
}

function createPasoId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${suffix}`;
}

async function getPoiById(database: PasoDatabase, poiId: string) {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        id,
        name,
        description,
        category,
        latitude,
        longitude,
        geofence_radius_m,
        region,
        district,
        source,
        base_xp
      FROM pois
      WHERE id = ?;
    `,
    [poiId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`POI not found: ${poiId}`);
  }

  const [
    id,
    name,
    description,
    category,
    latitude,
    longitude,
    geofenceRadius,
    region,
    district,
    source,
    baseXp,
  ] = row;

  return {
    id: asString(id),
    name: asString(name),
    description: asOptionalString(description),
    category: category as POI["category"],
    latitude: asNumber(latitude),
    longitude: asNumber(longitude),
    geofence_radius_m: asNumber(geofenceRadius),
    region: asString(region),
    district: asString(district),
    source: asString(source),
    base_xp: asNumber(baseXp),
  } satisfies POI;
}

async function awardXp(
  database: PasoDatabase,
  sourceType: string,
  sourceId: string,
  xpAmount: number,
  note: string,
) {
  await database.sqlite3.execWithParams(
    database.db,
    `
      INSERT INTO xp_log (source_type, source_id, xp_amount, note)
      VALUES (?, ?, ?, ?);
    `,
    [sourceType, sourceId, xpAmount, note],
  );
}

async function syncProfileAndStats(database: PasoDatabase) {
  const aggregateResult = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        (SELECT COUNT(*) FROM visits) AS total_visits,
        (SELECT COUNT(DISTINCT poi_id) FROM visits) AS unique_pois_visited,
        (SELECT COUNT(*) FROM reviews) AS total_reviews,
        (SELECT COALESCE(SUM(xp_amount), 0) FROM xp_log) AS total_xp;
    `,
  );

  const [totals] = aggregateResult.rows;
  const totalVisits = asNumber(totals?.[0]);
  const uniquePoisVisited = asNumber(totals?.[1]);
  const totalReviews = asNumber(totals?.[2]);
  const totalXp = asNumber(totals?.[3]);
  const level = deriveLevel(totalXp);
  const photoResult = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT photo_ids FROM visits
      UNION ALL
      SELECT photo_ids FROM reviews;
    `,
  );
  const totalPhotos = new Set(
    photoResult.rows.flatMap(([photoIds]) => asStringArray(photoIds)),
  ).size;

  await database.sqlite3.execWithParams(
    database.db,
    `
      UPDATE profile
      SET
        total_xp = ?,
        level = ?
      WHERE id = 1;
    `,
    [totalXp, level],
  );

  await database.sqlite3.execWithParams(
    database.db,
    `
      UPDATE stats
      SET
        total_visits = ?,
        unique_pois_visited = ?,
        total_reviews = ?,
        total_photos = ?,
        total_xp = ?,
        level = ?,
        updated_at = datetime('now')
      WHERE id = 1;
    `,
    [totalVisits, uniquePoisVisited, totalReviews, totalPhotos, totalXp, level],
  );
}

export async function countPOIs(database: PasoDatabase) {
  const result = await database.sqlite3.execWithParams(
    database.db,
    "SELECT COUNT(*) FROM pois;",
  );

  return Number(result.rows[0]?.[0] ?? 0);
}

export async function insertPOIs(database: PasoDatabase, pois: POI[]) {
  if (!pois.length) {
    return 0;
  }

  const query = `
    INSERT INTO pois (
      id,
      name,
      description,
      category,
      latitude,
      longitude,
      geofence_radius_m,
      region,
      district,
      source,
      base_xp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      geofence_radius_m = excluded.geofence_radius_m,
      region = excluded.region,
      district = excluded.district,
      source = excluded.source,
      base_xp = excluded.base_xp;
  `;

  await database.sqlite3.executeBatch(
    database.db,
    pois.map(() => query),
    pois.map((poi) => [
      poi.id,
      poi.name,
      poi.description ?? null,
      poi.category,
      poi.latitude,
      poi.longitude,
      poi.geofence_radius_m,
      poi.region,
      poi.district,
      poi.source,
      poi.base_xp,
    ]),
  );

  return pois.length;
}

async function queryPOIs(
  database: PasoDatabase,
  limit: number,
  includeLegacy: boolean,
) {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        id,
        name,
        description,
        category,
        latitude,
        longitude,
        geofence_radius_m,
        region,
        district,
        source,
        base_xp
      FROM pois
      ${includeLegacy ? "" : "WHERE source <> 'dummy'"}
      ORDER BY id
      LIMIT ?;
    `,
    [limit],
  );

  return result.rows.map(
    ([
      id,
      name,
      description,
      category,
      latitude,
      longitude,
      geofenceRadius,
      region,
      district,
      source,
      baseXp,
    ]): POI => ({
      id: asString(id),
      name: asString(name),
      description: asOptionalString(description),
      category: category as POI["category"],
      latitude: asNumber(latitude),
      longitude: asNumber(longitude),
      geofence_radius_m: asNumber(geofenceRadius),
      region: asString(region),
      district: asString(district),
      source: asString(source),
      base_xp: asNumber(baseXp),
    }),
  );
}

export function getPOIs(database: PasoDatabase, limit = 100) {
  return queryPOIs(database, limit, false);
}

export function getAllPOIs(database: PasoDatabase) {
  return queryPOIs(database, -1, true);
}

export type PlaceStateFilter = "all" | "saved" | "visited";

export type PlaceSearchOptions = {
  query?: string;
  category?: POI["category"];
  state?: PlaceStateFilter;
  limit?: number;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function getPlaceSummaries(
  database: PasoDatabase,
  options: PlaceSearchOptions = {},
): Promise<PlaceSummary[]> {
  const conditions: string[] = ["p.source <> 'dummy'"];
  const bindings: Array<string | number> = [];
  const query = options.query?.trim();

  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    conditions.push(`
      (
        p.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        COALESCE(p.description, '') LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        COALESCE(p.region, '') LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        COALESCE(p.district, '') LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        EXISTS (
          SELECT 1
          FROM poi_tags search_pt
          JOIN tags search_t ON search_t.id = search_pt.tag_id
          WHERE search_pt.poi_id = p.id
            AND search_t.name LIKE ? ESCAPE '\\' COLLATE NOCASE
        )
      )
    `);
    bindings.push(pattern, pattern, pattern, pattern, pattern);
  }

  if (options.category) {
    conditions.push("p.category = ?");
    bindings.push(options.category);
  }

  if (options.state === "saved") {
    conditions.push("COALESCE(user_state.is_saved, 0) = 1");
  } else if (options.state === "visited") {
    conditions.push("EXISTS (SELECT 1 FROM visits state_visit WHERE state_visit.poi_id = p.id)");
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  bindings.push(options.limit ?? 100);

  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category,
        p.latitude,
        p.longitude,
        p.geofence_radius_m,
        p.region,
        p.district,
        p.source,
        p.base_xp,
        COALESCE(user_state.is_saved, 0),
        CASE WHEN COUNT(visits.id) > 0 THEN 1 ELSE 0 END,
        COUNT(visits.id),
        MAX(visits.arrived_at),
        COALESCE((
          SELECT GROUP_CONCAT(ordered_tags.name, CHAR(31))
          FROM (
            SELECT tag.name
            FROM poi_tags place_tag
            JOIN tags tag ON tag.id = place_tag.tag_id
            WHERE place_tag.poi_id = p.id
            ORDER BY place_tag.rowid
          ) AS ordered_tags
        ), '')
      FROM pois p
      LEFT JOIN poi_user_state user_state ON user_state.poi_id = p.id
      LEFT JOIN visits ON visits.poi_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY
        COALESCE(user_state.is_saved, 0) DESC,
        MAX(visits.arrived_at) DESC,
        p.name COLLATE NOCASE
      LIMIT ?;
    `,
    bindings,
  );

  return result.rows.map(
    ([
      id,
      name,
      description,
      category,
      latitude,
      longitude,
      geofenceRadius,
      region,
      district,
      source,
      baseXp,
      isSaved,
      isVisited,
      visitCount,
      lastVisitedAt,
      tags,
    ]): PlaceSummary => ({
      id: asString(id),
      name: asString(name),
      description: asOptionalString(description),
      category: category as POI["category"],
      latitude: asNumber(latitude),
      longitude: asNumber(longitude),
      geofence_radius_m: asNumber(geofenceRadius),
      region: asString(region),
      district: asString(district),
      source: asString(source),
      base_xp: asNumber(baseXp),
      is_saved: Boolean(asNumber(isSaved)),
      is_visited: Boolean(asNumber(isVisited)),
      visit_count: asNumber(visitCount),
      last_visited_at: asOptionalString(lastVisitedAt),
      tags:
        typeof tags === "string" && tags.length > 0
          ? tags.split(String.fromCharCode(31))
          : [],
    }),
  );
}

export async function setPOISaved(
  database: PasoDatabase,
  poiId: string,
  saved: boolean,
) {
  await getPoiById(database, poiId);
  await database.sqlite3.execWithParams(
    database.db,
    `
      INSERT INTO poi_user_state (
        poi_id, is_saved, saved_at, updated_at
      ) VALUES (?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, datetime('now'))
      ON CONFLICT(poi_id) DO UPDATE SET
        is_saved = excluded.is_saved,
        saved_at = CASE
          WHEN excluded.is_saved = 1 THEN COALESCE(poi_user_state.saved_at, datetime('now'))
          ELSE NULL
        END,
        updated_at = datetime('now');
    `,
    [poiId, saved ? 1 : 0, saved ? 1 : 0],
  );
}

function normalizeTagNames(tagNames: string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawName of tagNames) {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (name.length > 24) {
      throw new Error("태그는 24자 이하여야 합니다.");
    }

    const key = name.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(name);
    }
  }

  if (normalized.length > 8) {
    throw new Error("장소당 태그는 최대 8개까지 저장할 수 있습니다.");
  }

  return normalized;
}

export async function setPOITags(
  database: PasoDatabase,
  poiId: string,
  tagNames: string[],
) {
  await getPoiById(database, poiId);
  const normalizedNames = normalizeTagNames(tagNames);

  await withImmediateTransaction(database, async () => {
    await database.sqlite3.execWithParams(
      database.db,
      "DELETE FROM poi_tags WHERE poi_id = ?;",
      [poiId],
    );

    for (const name of normalizedNames) {
      let tagResult = await database.sqlite3.execWithParams(
        database.db,
        "SELECT id FROM tags WHERE name = ? COLLATE NOCASE;",
        [name],
      );
      let tagId = asOptionalString(tagResult.rows[0]?.[0]);

      if (!tagId) {
        tagId = createPasoId("tag");
        await database.sqlite3.execWithParams(
          database.db,
          "INSERT INTO tags (id, name) VALUES (?, ?);",
          [tagId, name],
        );
        tagResult = await database.sqlite3.execWithParams(
          database.db,
          "SELECT id FROM tags WHERE id = ?;",
          [tagId],
        );
        tagId = asString(tagResult.rows[0]?.[0]);
      }

      await database.sqlite3.execWithParams(
        database.db,
        "INSERT OR IGNORE INTO poi_tags (poi_id, tag_id) VALUES (?, ?);",
        [poiId, tagId],
      );
    }

    await database.sqlite3.exec(
      database.db,
      `
        DELETE FROM tags
        WHERE NOT EXISTS (
          SELECT 1 FROM poi_tags WHERE poi_tags.tag_id = tags.id
        );
      `,
    );
  });

  return normalizedNames;
}

export async function getProfile(database: PasoDatabase): Promise<Profile> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT nickname, created_at, total_xp, level
      FROM profile
      WHERE id = 1;
    `,
  );

  const [row] = result.rows;
  return {
    nickname: asString(row?.[0] ?? "Paso Walker"),
    created_at: asString(row?.[1] ?? new Date().toISOString()),
    total_xp: asNumber(row?.[2]),
    level: asNumber(row?.[3]) || 1,
  };
}

export async function getStats(database: PasoDatabase): Promise<Stats> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        total_visits,
        unique_pois_visited,
        total_reviews,
        total_photos,
        total_distance_km,
        total_xp,
        level,
        current_streak,
        steps_today,
        steps_weekly_avg,
        updated_at
      FROM stats
      WHERE id = 1;
    `,
  );

  const [row] = result.rows;
  return {
    total_visits: asNumber(row?.[0]),
    unique_pois_visited: asNumber(row?.[1]),
    total_reviews: asNumber(row?.[2]),
    total_photos: asNumber(row?.[3]),
    total_distance_km: asNumber(row?.[4]),
    total_xp: asNumber(row?.[5]),
    level: asNumber(row?.[6]) || 1,
    current_streak: asNumber(row?.[7]),
    steps_today: asNumber(row?.[8]),
    steps_weekly_avg: asNumber(row?.[9]),
    updated_at: asString(row?.[10] ?? new Date().toISOString()),
  };
}

export async function createVisit(
  database: PasoDatabase,
  input: CreateVisitInput,
): Promise<Visit> {
  const poi = await getPoiById(database, input.poiId);
  const firstVisitCheck = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT COUNT(*)
      FROM visits
      WHERE poi_id = ?;
    `,
    [input.poiId],
  );
  const isFirstVisit = asNumber(firstVisitCheck.rows[0]?.[0]) === 0;
  const photoIds = input.photoIds ?? [];
  const { breakdown, totalXp } = calculateVisitXP(
    poi.base_xp,
    isFirstVisit,
    photoIds.length,
  );
  const visitId = createPasoId("visit");
  const createdAt = input.arrivedAt;

  await database.sqlite3.execWithParams(
    database.db,
    `
      INSERT INTO visits (
        id,
        poi_id,
        arrived_at,
        departed_at,
        dwell_time_minutes,
        latitude,
        longitude,
        gps_accuracy_m,
        memo,
        mood,
        verification_mode,
        photo_ids,
        xp_earned,
        xp_breakdown_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      visitId,
      input.poiId,
      input.arrivedAt,
      input.departedAt ?? null,
      input.dwellTimeMinutes ?? null,
      input.latitude,
      input.longitude,
      input.gpsAccuracyM ?? null,
      input.memo ?? null,
      input.mood ?? null,
      input.verificationMode ?? "manual",
      JSON.stringify(photoIds),
      totalXp,
      JSON.stringify(breakdown),
      createdAt,
    ],
  );

  await awardXp(
    database,
    "visit",
    visitId,
    breakdown.base_visit,
    `${poi.name} local visit`,
  );

  if (breakdown.first_visit_bonus > 0) {
    await awardXp(
      database,
      "first_visit",
      visitId,
      breakdown.first_visit_bonus,
      `${poi.name} first local footprint`,
    );
  }

  if (breakdown.photo_bonus > 0) {
    await awardXp(
      database,
      "visit_photo",
      visitId,
      breakdown.photo_bonus,
      `${poi.name} photo memory`,
    );
  }

  await syncProfileAndStats(database);

  return {
    id: visitId,
    poi_id: poi.id,
    poi_name: poi.name,
    poi_category: poi.category,
    arrived_at: input.arrivedAt,
    departed_at: input.departedAt,
    dwell_time_minutes: input.dwellTimeMinutes,
    latitude: input.latitude,
    longitude: input.longitude,
    gps_accuracy_m: input.gpsAccuracyM,
    memo: input.memo,
    mood: input.mood,
    verification_mode: input.verificationMode ?? "manual",
    photo_ids: photoIds,
    xp_earned: totalXp,
    xp_breakdown: breakdown,
    created_at: createdAt,
  };
}

export async function createReview(
  database: PasoDatabase,
  input: CreateReviewInput,
): Promise<Review> {
  const existingResult = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT id, created_at
      FROM reviews
      WHERE visit_id = ?;
    `,
    [input.visitId],
  );
  const existing = existingResult.rows[0];
  const reviewId = asString(existing?.[0] ?? createPasoId("review"));
  const createdAt = asString(existing?.[1] ?? new Date().toISOString());
  const updatedAt = new Date().toISOString();
  const tagsJson = JSON.stringify(input.tags ?? []);
  const photoIdsJson = JSON.stringify(input.photoIds ?? []);

  await database.sqlite3.execWithParams(
    database.db,
    `
      INSERT OR REPLACE INTO reviews (
        id,
        poi_id,
        visit_id,
        rating,
        text,
        tags_json,
        photo_ids,
        is_shared,
        shared_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      reviewId,
      input.poiId,
      input.visitId,
      input.rating,
      input.text,
      tagsJson,
      photoIdsJson,
      0,
      null,
      createdAt,
      updatedAt,
    ],
  );

  if (!existing) {
    const reviewXp = calculateReviewXP();
    await awardXp(
      database,
      "review",
      reviewId,
      reviewXp,
      "Local review bonus",
    );
  }

  await syncProfileAndStats(database);
  const poi = await getPoiById(database, input.poiId);

  return {
    id: reviewId,
    poi_id: input.poiId,
    poi_name: poi.name,
    visit_id: input.visitId,
    rating: input.rating,
    text: input.text,
    tags: input.tags ?? [],
    photo_ids: input.photoIds ?? [],
    is_shared: false,
    shared_at: undefined,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function getRecentVisits(
  database: PasoDatabase,
  limit = 10,
): Promise<Visit[]> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        visits.id,
        visits.poi_id,
        pois.name,
        pois.category,
        visits.arrived_at,
        visits.departed_at,
        visits.dwell_time_minutes,
        visits.latitude,
        visits.longitude,
        visits.gps_accuracy_m,
        visits.memo,
        visits.mood,
        visits.verification_mode,
        visits.photo_ids,
        visits.xp_earned,
        visits.xp_breakdown_json,
        visits.created_at
      FROM visits
      LEFT JOIN pois ON pois.id = visits.poi_id
      ORDER BY visits.arrived_at DESC
      LIMIT ?;
    `,
    [limit],
  );

  return result.rows.map(
    ([
      id,
      poiId,
      poiName,
      poiCategory,
      arrivedAt,
      departedAt,
      dwellTime,
      latitude,
      longitude,
      gpsAccuracy,
      memo,
      mood,
      verificationMode,
      photoIds,
      xpEarned,
      xpBreakdown,
      createdAt,
    ]): Visit => ({
      id: asString(id),
      poi_id: asString(poiId),
      poi_name: asString(poiName),
      poi_category: (poiCategory as POI["category"]) ?? "custom",
      arrived_at: asString(arrivedAt),
      departed_at: asOptionalString(departedAt),
      dwell_time_minutes:
        dwellTime == null ? undefined : asNumber(dwellTime),
      latitude: asNumber(latitude),
      longitude: asNumber(longitude),
      gps_accuracy_m:
        gpsAccuracy == null ? undefined : asNumber(gpsAccuracy),
      memo: asOptionalString(memo),
      mood: asOptionalString(mood),
      verification_mode:
        verificationMode === "gps" ? "gps" : "manual",
      photo_ids: asStringArray(photoIds),
      xp_earned: asNumber(xpEarned),
      xp_breakdown: asXPBreakdown(xpBreakdown),
      created_at: asString(createdAt),
    }),
  );
}

export function getAllVisits(database: PasoDatabase) {
  return getRecentVisits(database, -1);
}

export async function getRecentReviews(
  database: PasoDatabase,
  limit = 10,
): Promise<Review[]> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        reviews.id,
        reviews.poi_id,
        pois.name,
        reviews.visit_id,
        reviews.rating,
        reviews.text,
        reviews.tags_json,
        reviews.photo_ids,
        reviews.is_shared,
        reviews.shared_at,
        reviews.created_at,
        reviews.updated_at
      FROM reviews
      LEFT JOIN pois ON pois.id = reviews.poi_id
      ORDER BY reviews.created_at DESC
      LIMIT ?;
    `,
    [limit],
  );

  return result.rows.map(
    ([
      id,
      poiId,
      poiName,
      visitId,
      rating,
      text,
      tagsJson,
      photoIds,
      isShared,
      sharedAt,
      createdAt,
      updatedAt,
    ]): Review => ({
      id: asString(id),
      poi_id: asString(poiId),
      poi_name: asString(poiName),
      visit_id: asString(visitId),
      rating: asNumber(rating),
      text: asString(text),
      tags: asStringArray(tagsJson),
      photo_ids: asStringArray(photoIds),
      is_shared: Boolean(asNumber(isShared)),
      shared_at: asOptionalString(sharedAt),
      created_at: asString(createdAt),
      updated_at: asOptionalString(updatedAt),
    }),
  );
}

export function getAllReviews(database: PasoDatabase) {
  return getRecentReviews(database, -1);
}
