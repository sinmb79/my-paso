import {
  getAllPOIs,
  getAllReviews,
  getAllVisits,
  getProfile,
  getStats,
} from "@/lib/db/queries";
import {
  executeStatementsOrThrow,
  withImmediateTransaction,
} from "@/lib/db/transaction";
import {
  deleteJournalPhoto,
  readJournalPhotoData,
  restoreJournalPhotoData,
} from "@/lib/media/photo-store";

import type {
  POI,
  JournalPhotoSnapshot,
  PasoDatabase,
  PasoSnapshot,
  PlaceCollectionSnapshot,
  Review,
  Visit,
  XPLogEntry,
} from "@/types";

const SNAPSHOT_VERSION = "2.1-local";
const SCHEMA_VERSION = 2;
const APP_VERSION = "0.2.0";
const LEGACY_SNAPSHOT_VERSIONS = new Set(["2.0-local", "0.2.0-local"]);

export type PasoSnapshotInspection = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  version: string | null;
  exportedAt: string | null;
  recordCounts: {
    pois: number;
    visits: number;
    reviews: number;
    xp_log: number;
    place_collections: number;
    media: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : canonicalize(item),
    );
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 is unavailable in this browser.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function calculateSnapshotChecksum(snapshot: PasoSnapshot) {
  const payload = { ...snapshot };
  delete payload.checksum;
  return sha256Hex(JSON.stringify(canonicalize(payload)));
}

function findDuplicateIds(
  label: string,
  values: Array<{ id?: unknown }>,
  errors: string[],
) {
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value.id !== "string" || value.id.length === 0) {
      errors.push(`${label} contains a record without a valid id.`);
      continue;
    }

    if (seen.has(value.id)) {
      errors.push(`${label} contains a duplicate id: ${value.id}.`);
    }
    seen.add(value.id);
  }
}

async function getXPLog(database: PasoDatabase): Promise<XPLogEntry[]> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT id, source_type, source_id, xp_amount, timestamp, note
      FROM xp_log
      ORDER BY id ASC;
    `,
  );

  return result.rows.map(
    ([id, sourceType, sourceId, xpAmount, timestamp, note]) => ({
      id: Number(id ?? 0),
      source_type: String(sourceType ?? ""),
      source_id: sourceId == null ? undefined : String(sourceId),
      xp_amount: Number(xpAmount ?? 0),
      timestamp: String(timestamp ?? ""),
      note: note == null ? undefined : String(note),
    }),
  );
}

async function getPlaceCollections(
  database: PasoDatabase,
): Promise<PlaceCollectionSnapshot[]> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        pois.id,
        COALESCE(user_state.is_saved, 0),
        user_state.saved_at,
        user_state.personal_note,
        COALESCE((
          SELECT GROUP_CONCAT(ordered_tags.name, CHAR(31))
          FROM (
            SELECT tags.name
            FROM poi_tags
            JOIN tags ON tags.id = poi_tags.tag_id
            WHERE poi_tags.poi_id = pois.id
            ORDER BY poi_tags.rowid
          ) AS ordered_tags
        ), '')
      FROM pois
      LEFT JOIN poi_user_state user_state ON user_state.poi_id = pois.id
      WHERE user_state.poi_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM poi_tags WHERE poi_tags.poi_id = pois.id)
      ORDER BY pois.id;
    `,
  );

  return result.rows.map(
    ([poiId, isSaved, savedAt, personalNote, tags]) => ({
      poi_id: String(poiId ?? ""),
      is_saved: Boolean(Number(isSaved ?? 0)),
      saved_at: savedAt == null ? undefined : String(savedAt),
      personal_note: personalNote == null ? undefined : String(personalNote),
      tags:
        typeof tags === "string" && tags.length > 0
          ? tags.split(String.fromCharCode(31))
          : [],
    }),
  );
}

function referencedPhotoIds(visits: Visit[], reviews: Review[]) {
  return Array.from(
    new Set([
      ...visits.flatMap((visit) => visit.photo_ids),
      ...reviews.flatMap((review) => review.photo_ids),
    ]),
  ).sort();
}

async function getSnapshotMedia(visits: Visit[], reviews: Review[]) {
  const media: JournalPhotoSnapshot[] = [];
  for (const id of referencedPhotoIds(visits, reviews)) {
    const dataUrl = await readJournalPhotoData(id);
    if (!dataUrl) {
      throw new Error(`Referenced photo is missing from local storage: ${id}.`);
    }
    media.push({ id, data_url: dataUrl });
  }
  return media;
}

export async function exportPasoSnapshot(
  database: PasoDatabase,
): Promise<PasoSnapshot> {
  // wa-sqlite statements on one connection must stay sequential.
  const profile = await getProfile(database);
  const stats = await getStats(database);
  const visits = await getAllVisits(database);
  const reviews = await getAllReviews(database);
  const pois = await getAllPOIs(database);
  const xpLog = await getXPLog(database);
  const placeCollections = await getPlaceCollections(database);
  const media = await getSnapshotMedia(visits, reviews);

  const snapshot: PasoSnapshot = {
    version: SNAPSHOT_VERSION,
    schema_version: SCHEMA_VERSION,
    app_version: APP_VERSION,
    exported_at: new Date().toISOString(),
    profile,
    stats,
    visits,
    reviews,
    pois,
    xp_log: xpLog,
    place_collections: placeCollections,
    media,
    record_counts: {
      pois: pois.length,
      visits: visits.length,
      reviews: reviews.length,
      xp_log: xpLog.length,
      place_collections: placeCollections.length,
      media: media.length,
    },
  };

  return {
    ...snapshot,
    checksum: await calculateSnapshotChecksum(snapshot),
  };
}

export async function inspectPasoSnapshot(
  snapshot: unknown,
): Promise<PasoSnapshotInspection> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(snapshot)) {
    return {
      valid: false,
      errors: ["Backup payload must be a JSON object."],
      warnings,
      version: null,
      exportedAt: null,
      recordCounts: {
        pois: 0,
        visits: 0,
        reviews: 0,
        xp_log: 0,
        place_collections: 0,
        media: 0,
      },
    };
  }

  const version =
    typeof snapshot.version === "string" ? snapshot.version : null;
  const exportedAt =
    typeof snapshot.exported_at === "string" ? snapshot.exported_at : null;
  const pois = Array.isArray(snapshot.pois) ? snapshot.pois : [];
  const visits = Array.isArray(snapshot.visits) ? snapshot.visits : [];
  const reviews = Array.isArray(snapshot.reviews) ? snapshot.reviews : [];
  const xpLog = Array.isArray(snapshot.xp_log) ? snapshot.xp_log : [];
  const placeCollections = Array.isArray(snapshot.place_collections)
    ? snapshot.place_collections
    : [];
  const media = Array.isArray(snapshot.media) ? snapshot.media : [];
  const recordCounts = {
    pois: pois.length,
    visits: visits.length,
    reviews: reviews.length,
    xp_log: xpLog.length,
    place_collections: placeCollections.length,
    media: media.length,
  };

  if (!version) {
    errors.push("Backup version is missing.");
  } else if (
    version !== SNAPSHOT_VERSION &&
    !LEGACY_SNAPSHOT_VERSIONS.has(version)
  ) {
    errors.push(`Unsupported backup version: ${version}.`);
  }

  if (!exportedAt || Number.isNaN(Date.parse(exportedAt))) {
    errors.push("Backup export date is missing or invalid.");
  }
  if (!isRecord(snapshot.profile)) {
    errors.push("Backup profile is missing.");
  }
  if (!isRecord(snapshot.stats)) {
    errors.push("Backup stats are missing.");
  }
  if (!Array.isArray(snapshot.pois)) {
    errors.push("Backup POI records are missing.");
  }
  if (!Array.isArray(snapshot.visits)) {
    errors.push("Backup visit records are missing.");
  }
  if (!Array.isArray(snapshot.reviews)) {
    errors.push("Backup review records are missing.");
  }
  if (!Array.isArray(snapshot.xp_log)) {
    warnings.push("Legacy backup has no XP log; an empty log will be restored.");
  }
  if (!Array.isArray(snapshot.place_collections)) {
    if (version === SNAPSHOT_VERSION) {
      errors.push("Backup place collection records are missing.");
    } else {
      warnings.push("Legacy backup has no saved places or place tags.");
    }
  }
  if (!Array.isArray(snapshot.media)) {
    if (version === SNAPSHOT_VERSION) {
      errors.push("Backup media records are missing.");
    } else {
      warnings.push("Legacy backup does not include photo files.");
    }
  }

  findDuplicateIds("POI list", pois, errors);
  findDuplicateIds("Visit list", visits, errors);
  findDuplicateIds("Review list", reviews, errors);

  const collectionPoiIds = new Set<string>();
  for (const collection of placeCollections) {
    if (!isRecord(collection) || typeof collection.poi_id !== "string") {
      errors.push("Place collection contains an invalid POI reference.");
      continue;
    }
    if (collectionPoiIds.has(collection.poi_id)) {
      errors.push(`Place collection contains a duplicate POI: ${collection.poi_id}.`);
    }
    collectionPoiIds.add(collection.poi_id);
    if (typeof collection.is_saved !== "boolean") {
      errors.push(`Place collection has an invalid saved state: ${collection.poi_id}.`);
    }
    if (
      !Array.isArray(collection.tags) ||
      collection.tags.some((tag) => typeof tag !== "string") ||
      collection.tags.length > 8
    ) {
      errors.push(`Place collection has invalid tags: ${collection.poi_id}.`);
    }
  }

  const mediaIds = new Set<string>();
  for (const mediaRecord of media) {
    if (
      !isRecord(mediaRecord) ||
      typeof mediaRecord.id !== "string" ||
      !/^photo-[a-z0-9-]+\.(jpg|png|webp)$/i.test(mediaRecord.id) ||
      typeof mediaRecord.data_url !== "string" ||
      !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(mediaRecord.data_url)
    ) {
      errors.push("Backup media contains an invalid photo record.");
      continue;
    }
    if (mediaIds.has(mediaRecord.id)) {
      errors.push(`Backup media contains a duplicate photo: ${mediaRecord.id}.`);
    }
    mediaIds.add(mediaRecord.id);
  }

  const poiIds = new Set(
    pois
      .map((poi) => (isRecord(poi) ? poi.id : null))
      .filter((id): id is string => typeof id === "string"),
  );
  const visitIds = new Set(
    visits
      .map((visit) => (isRecord(visit) ? visit.id : null))
      .filter((id): id is string => typeof id === "string"),
  );

  for (const visit of visits) {
    if (!isRecord(visit) || typeof visit.poi_id !== "string") {
      errors.push("Visit list contains an invalid POI reference.");
    } else if (!poiIds.has(visit.poi_id)) {
      errors.push(`Visit references a missing POI: ${visit.poi_id}.`);
    }
  }

  for (const review of reviews) {
    if (!isRecord(review)) {
      errors.push("Review list contains an invalid record.");
      continue;
    }
    if (typeof review.poi_id !== "string" || !poiIds.has(review.poi_id)) {
      errors.push(`Review references a missing POI: ${String(review.poi_id)}.`);
    }
    if (
      typeof review.visit_id !== "string" ||
      !visitIds.has(review.visit_id)
    ) {
      errors.push(
        `Review references a missing visit: ${String(review.visit_id)}.`,
      );
    }
    if (
      typeof review.rating !== "number" ||
      review.rating < 1 ||
      review.rating > 5
    ) {
      errors.push(`Review has an invalid rating: ${String(review.rating)}.`);
    }
  }

  for (const collection of placeCollections) {
    if (
      isRecord(collection) &&
      typeof collection.poi_id === "string" &&
      !poiIds.has(collection.poi_id)
    ) {
      errors.push(`Place collection references a missing POI: ${collection.poi_id}.`);
    }
  }

  if (Array.isArray(snapshot.media)) {
    const referencedIds = new Set<string>();
    for (const visit of visits) {
      if (isRecord(visit) && Array.isArray(visit.photo_ids)) {
        visit.photo_ids.forEach((id) => {
          if (typeof id === "string") referencedIds.add(id);
        });
      }
    }
    for (const review of reviews) {
      if (isRecord(review) && Array.isArray(review.photo_ids)) {
        review.photo_ids.forEach((id) => {
          if (typeof id === "string") referencedIds.add(id);
        });
      }
    }
    for (const id of referencedIds) {
      if (!mediaIds.has(id)) {
        errors.push(`Backup references a missing photo: ${id}.`);
      }
    }
  }

  if (isRecord(snapshot.record_counts)) {
    const manifestKeys = (
      version === SNAPSHOT_VERSION
        ? Object.keys(recordCounts)
        : Object.keys(recordCounts).filter(
            (key) => key !== "place_collections" && key !== "media",
          )
    ) as Array<keyof typeof recordCounts>;
    for (const key of manifestKeys) {
      if (snapshot.record_counts[key] !== recordCounts[key]) {
        errors.push(`Backup ${key} count does not match its manifest.`);
      }
    }
  } else if (version === SNAPSHOT_VERSION) {
    errors.push("Backup record count manifest is missing.");
  } else {
    warnings.push("Legacy backup has no record count manifest.");
  }

  if (typeof snapshot.checksum === "string") {
    const expectedChecksum = await calculateSnapshotChecksum(
      snapshot as unknown as PasoSnapshot,
    );
    if (snapshot.checksum !== expectedChecksum) {
      errors.push("Backup checksum does not match its contents.");
    }
  } else if (version === SNAPSHOT_VERSION) {
    errors.push("Backup checksum is missing.");
  } else {
    warnings.push("Legacy backup has no checksum.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    version,
    exportedAt,
    recordCounts,
  };
}

async function restorePOIs(database: PasoDatabase, pois: POI[]) {
  await executeStatementsOrThrow(
    database,
    `
      INSERT INTO pois (
        id, name, description, category, latitude, longitude,
        geofence_radius_m, region, district, source, base_xp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
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
}

async function restoreVisits(database: PasoDatabase, visits: Visit[]) {
  await executeStatementsOrThrow(
    database,
    `
      INSERT INTO visits (
        id, poi_id, arrived_at, departed_at, dwell_time_minutes,
        latitude, longitude, gps_accuracy_m, memo, mood, photo_ids,
        verification_mode, xp_earned, xp_breakdown_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    visits.map((visit) => [
      visit.id,
      visit.poi_id,
      visit.arrived_at,
      visit.departed_at ?? null,
      visit.dwell_time_minutes ?? null,
      visit.latitude,
      visit.longitude,
      visit.gps_accuracy_m ?? null,
      visit.memo ?? null,
      visit.mood ?? null,
      JSON.stringify(visit.photo_ids ?? []),
      visit.verification_mode ?? "manual",
      visit.xp_earned,
      JSON.stringify(visit.xp_breakdown),
      visit.created_at,
    ]),
  );
}

async function restoreReviews(database: PasoDatabase, reviews: Review[]) {
  await executeStatementsOrThrow(
    database,
    `
      INSERT INTO reviews (
        id, poi_id, visit_id, rating, text, tags_json, photo_ids,
        is_shared, shared_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    reviews.map((review) => [
      review.id,
      review.poi_id,
      review.visit_id,
      review.rating,
      review.text,
      JSON.stringify(review.tags ?? []),
      JSON.stringify(review.photo_ids ?? []),
      review.is_shared ? 1 : 0,
      review.shared_at ?? null,
      review.created_at,
      review.updated_at ?? null,
    ]),
  );
}

async function restoreXPLog(database: PasoDatabase, xpLog: XPLogEntry[]) {
  await executeStatementsOrThrow(
    database,
    `
      INSERT INTO xp_log (id, source_type, source_id, xp_amount, timestamp, note)
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    xpLog.map((entry) => [
      entry.id ?? null,
      entry.source_type,
      entry.source_id ?? null,
      entry.xp_amount,
      entry.timestamp,
      entry.note ?? null,
    ]),
  );
}

async function restorePlaceCollections(
  database: PasoDatabase,
  collections: PlaceCollectionSnapshot[],
) {
  const tagIds = new Map<string, string>();

  for (const collection of collections) {
    if (collection.is_saved || collection.saved_at || collection.personal_note) {
      await database.sqlite3.execWithParams(
        database.db,
        `
          INSERT INTO poi_user_state (
            poi_id, is_saved, saved_at, personal_note, updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'));
        `,
        [
          collection.poi_id,
          collection.is_saved ? 1 : 0,
          collection.saved_at ?? null,
          collection.personal_note ?? null,
        ],
      );
    }

    for (const tagName of collection.tags) {
      const key = tagName.toLocaleLowerCase();
      let tagId = tagIds.get(key);
      if (!tagId) {
        tagId = `restored-tag-${tagIds.size + 1}`;
        tagIds.set(key, tagId);
        await database.sqlite3.execWithParams(
          database.db,
          "INSERT INTO tags (id, name) VALUES (?, ?);",
          [tagId, tagName],
        );
      }
      await database.sqlite3.execWithParams(
        database.db,
        "INSERT INTO poi_tags (poi_id, tag_id) VALUES (?, ?);",
        [collection.poi_id, tagId],
      );
    }
  }
}

async function verifyRestoredRecords(
  database: PasoDatabase,
  snapshot: PasoSnapshot,
) {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT
        (SELECT COUNT(*) FROM pois),
        (SELECT COUNT(*) FROM visits),
        (SELECT COUNT(*) FROM reviews),
        (SELECT COUNT(*) FROM xp_log),
        (
          SELECT COUNT(*)
          FROM pois
          LEFT JOIN poi_user_state ON poi_user_state.poi_id = pois.id
          WHERE poi_user_state.poi_id IS NOT NULL
            OR EXISTS (SELECT 1 FROM poi_tags WHERE poi_tags.poi_id = pois.id)
        );
    `,
  );
  const row = result.rows[0] ?? [];
  const expected = [
    snapshot.pois.length,
    snapshot.visits.length,
    snapshot.reviews.length,
    snapshot.xp_log?.length ?? 0,
    snapshot.place_collections?.length ?? 0,
  ];

  if (expected.some((count, index) => Number(row[index] ?? -1) !== count)) {
    throw new Error("Restore record count verification failed.");
  }

  const foreignKeyCheck = await database.sqlite3.execWithParams(
    database.db,
    "PRAGMA foreign_key_check;",
  );
  if (foreignKeyCheck.rows.length > 0) {
    throw new Error("Restore foreign key verification failed.");
  }
}

export async function restorePasoSnapshot(
  database: PasoDatabase,
  snapshot: unknown,
) {
  const inspection = await inspectPasoSnapshot(snapshot);
  if (!inspection.valid) {
    throw new Error(`Backup validation failed: ${inspection.errors.join(" ")}`);
  }

  const payload = snapshot as PasoSnapshot;
  const xpLog = payload.xp_log ?? [];
  const placeCollections = payload.place_collections ?? [];
  const media = payload.media ?? [];
  const currentPhotoResult = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT photo_ids FROM visits
      UNION ALL
      SELECT photo_ids FROM reviews;
    `,
  );
  const currentPhotoIds = Array.from(
    new Set(
      currentPhotoResult.rows.flatMap(([value]) => {
        if (typeof value !== "string" || !value) return [];
        try {
          const parsed = JSON.parse(value) as unknown;
          return Array.isArray(parsed)
            ? parsed.filter((id): id is string => typeof id === "string")
            : [];
        } catch {
          return [];
        }
      }),
    ),
  );
  const previousMedia = new Map<string, string | null>();
  const restoredMediaIds: string[] = [];

  try {
    for (const photo of media) {
      previousMedia.set(photo.id, await readJournalPhotoData(photo.id));
      await restoreJournalPhotoData(photo.id, photo.data_url);
      restoredMediaIds.push(photo.id);
    }

    await withImmediateTransaction(database, async () => {
      await database.sqlite3.exec(
        database.db,
        `
          DELETE FROM reviews;
          DELETE FROM visits;
          DELETE FROM xp_log;
          DELETE FROM poi_tags;
          DELETE FROM tags;
          DELETE FROM poi_user_state;
          DELETE FROM pois;
        `,
      );

      await restorePOIs(database, payload.pois);
      await restorePlaceCollections(database, placeCollections);
      await restoreVisits(database, payload.visits);
      await restoreReviews(database, payload.reviews);
      await restoreXPLog(database, xpLog);

      await database.sqlite3.execWithParams(
        database.db,
        `
          UPDATE profile
          SET nickname = ?, created_at = ?, total_xp = ?, level = ?
          WHERE id = 1;
        `,
        [
          payload.profile.nickname,
          payload.profile.created_at,
          payload.profile.total_xp,
          payload.profile.level,
        ],
      );

      await database.sqlite3.execWithParams(
        database.db,
        `
          UPDATE stats
          SET
            total_visits = ?, unique_pois_visited = ?, total_reviews = ?,
            total_photos = ?, total_distance_km = ?, total_xp = ?, level = ?,
            current_streak = ?, steps_today = ?, steps_weekly_avg = ?,
            updated_at = ?
          WHERE id = 1;
        `,
        [
          payload.stats.total_visits,
          payload.stats.unique_pois_visited,
          payload.stats.total_reviews,
          payload.stats.total_photos,
          payload.stats.total_distance_km,
          payload.stats.total_xp,
          payload.stats.level,
          payload.stats.current_streak,
          payload.stats.steps_today,
          payload.stats.steps_weekly_avg,
          payload.stats.updated_at,
        ],
      );

      await verifyRestoredRecords(database, {
        ...payload,
        xp_log: xpLog,
        place_collections: placeCollections,
        media,
      });
    });
  } catch (error) {
    for (const photoId of restoredMediaIds.reverse()) {
      const previous = previousMedia.get(photoId);
      if (previous) {
        await restoreJournalPhotoData(photoId, previous);
      } else {
        await deleteJournalPhoto(photoId);
      }
    }
    throw error;
  }

  if (payload.media) {
    const restoredIdSet = new Set(media.map((photo) => photo.id));
    await Promise.allSettled(
      currentPhotoIds
        .filter((photoId) => !restoredIdSet.has(photoId))
        .map(deleteJournalPhoto),
    );
  }
}
