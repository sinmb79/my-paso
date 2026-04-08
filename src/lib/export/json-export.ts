import {
  insertPOIs,
  getPOIs,
  getProfile,
  getRecentReviews,
  getRecentVisits,
  getStats,
} from "@/lib/db/queries";

import type { PasoDatabase, PasoSnapshot, XPLogEntry } from "@/types";

async function getXPLog(database: PasoDatabase): Promise<XPLogEntry[]> {
  const result = await database.sqlite3.execWithParams(
    database.db,
    `
      SELECT id, source_type, source_id, xp_amount, timestamp, note
      FROM xp_log
      ORDER BY id ASC;
    `,
  );

  return result.rows.map(([id, sourceType, sourceId, xpAmount, timestamp, note]) => ({
    id: Number(id ?? 0),
    source_type: String(sourceType ?? ""),
    source_id: sourceId == null ? undefined : String(sourceId),
    xp_amount: Number(xpAmount ?? 0),
    timestamp: String(timestamp ?? ""),
    note: note == null ? undefined : String(note),
  }));
}

export async function exportPasoSnapshot(
  database: PasoDatabase,
): Promise<PasoSnapshot> {
  const profile = await getProfile(database);
  const stats = await getStats(database);
  const visits = await getRecentVisits(database, 100);
  const reviews = await getRecentReviews(database, 100);
  const pois = await getPOIs(database, 100);
  const xpLog = await getXPLog(database);

  return {
    version: "0.2.0-local",
    exported_at: new Date().toISOString(),
    profile,
    stats,
    visits,
    reviews,
    pois,
    xp_log: xpLog,
  };
}

export async function restorePasoSnapshot(
  database: PasoDatabase,
  snapshot: PasoSnapshot,
) {
  if (
    typeof snapshot !== "object" ||
    snapshot == null ||
    !Array.isArray(snapshot.pois) ||
    !Array.isArray(snapshot.visits) ||
    !Array.isArray(snapshot.reviews)
  ) {
    throw new Error("Invalid Paso snapshot payload.");
  }

  await database.sqlite3.exec(
    database.db,
    `
      DELETE FROM reviews;
      DELETE FROM visits;
      DELETE FROM xp_log;
      DELETE FROM pois;
    `,
  );

  await insertPOIs(database, snapshot.pois);

  if (snapshot.visits.length > 0) {
    await database.sqlite3.executeBatch(
      database.db,
      snapshot.visits.map(
        () => `
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
            photo_ids,
            xp_earned,
            xp_breakdown_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
      ),
      snapshot.visits.map((visit) => [
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
        visit.xp_earned,
        JSON.stringify(visit.xp_breakdown),
        visit.created_at,
      ]),
    );
  }

  if (snapshot.reviews.length > 0) {
    await database.sqlite3.executeBatch(
      database.db,
      snapshot.reviews.map(
        () => `
          INSERT INTO reviews (
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
      ),
      snapshot.reviews.map((review) => [
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

  if (snapshot.xp_log?.length) {
    await database.sqlite3.executeBatch(
      database.db,
      snapshot.xp_log.map(
        () => `
          INSERT INTO xp_log (id, source_type, source_id, xp_amount, timestamp, note)
          VALUES (?, ?, ?, ?, ?, ?);
        `,
      ),
      snapshot.xp_log.map((entry) => [
        entry.id ?? null,
        entry.source_type,
        entry.source_id ?? null,
        entry.xp_amount,
        entry.timestamp,
        entry.note ?? null,
      ]),
    );
  }

  await database.sqlite3.execWithParams(
    database.db,
    `
      UPDATE profile
      SET nickname = ?, created_at = ?, total_xp = ?, level = ?
      WHERE id = 1;
    `,
    [
      snapshot.profile.nickname,
      snapshot.profile.created_at,
      snapshot.profile.total_xp,
      snapshot.profile.level,
    ],
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
        total_distance_km = ?,
        total_xp = ?,
        level = ?,
        current_streak = ?,
        steps_today = ?,
        steps_weekly_avg = ?,
        updated_at = ?
      WHERE id = 1;
    `,
    [
      snapshot.stats.total_visits,
      snapshot.stats.unique_pois_visited,
      snapshot.stats.total_reviews,
      snapshot.stats.total_photos,
      snapshot.stats.total_distance_km,
      snapshot.stats.total_xp,
      snapshot.stats.level,
      snapshot.stats.current_streak,
      snapshot.stats.steps_today,
      snapshot.stats.steps_weekly_avg,
      snapshot.stats.updated_at,
    ],
  );
}
