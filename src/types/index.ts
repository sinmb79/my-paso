import type { SQLiteAPI } from "@/lib/db/sqlite-types";

export type POICategory =
  | "cultural_heritage"
  | "historic_site"
  | "tourist_attraction"
  | "nature"
  | "food"
  | "community"
  | "custom";

export interface POI {
  id: string;
  name: string;
  description?: string;
  category: POICategory;
  latitude: number;
  longitude: number;
  geofence_radius_m: number;
  region: string;
  district: string;
  source: string;
  base_xp: number;
}

export interface PlaceSummary extends POI {
  is_saved: boolean;
  is_visited: boolean;
  visit_count: number;
  last_visited_at?: string;
  tags: string[];
}

export interface XPBreakdown {
  base_visit: number;
  first_visit_bonus: number;
  review_bonus: number;
  photo_bonus: number;
  streak_bonus: number;
}

export interface Visit {
  id: string;
  poi_id: string;
  poi_name: string;
  poi_category: POICategory;
  arrived_at: string;
  departed_at?: string;
  dwell_time_minutes?: number;
  latitude: number;
  longitude: number;
  gps_accuracy_m?: number;
  memo?: string;
  mood?: string;
  verification_mode?: "manual" | "gps";
  photo_ids: string[];
  xp_earned: number;
  xp_breakdown: XPBreakdown;
  created_at: string;
}

export interface Review {
  id: string;
  poi_id: string;
  poi_name: string;
  visit_id: string;
  rating: number;
  text: string;
  tags: string[];
  photo_ids: string[];
  is_shared: boolean;
  shared_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  nickname: string;
  created_at: string;
  total_xp: number;
  level: number;
}

export interface Stats {
  total_visits: number;
  unique_pois_visited: number;
  total_reviews: number;
  total_photos: number;
  total_distance_km: number;
  total_xp: number;
  level: number;
  current_streak: number;
  steps_today: number;
  steps_weekly_avg: number;
  updated_at: string;
}

export interface CreateVisitInput {
  poiId: string;
  arrivedAt: string;
  departedAt?: string;
  dwellTimeMinutes?: number;
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  memo?: string;
  mood?: string;
  photoIds?: string[];
  verificationMode?: "manual" | "gps";
}

export interface CreateReviewInput {
  poiId: string;
  visitId: string;
  rating: number;
  text: string;
  tags?: string[];
  photoIds?: string[];
}

export interface XPLogEntry {
  id?: number;
  source_type: string;
  source_id?: string;
  xp_amount: number;
  timestamp: string;
  note?: string;
}

export interface PlaceCollectionSnapshot {
  poi_id: string;
  is_saved: boolean;
  saved_at?: string;
  personal_note?: string;
  tags: string[];
}

export interface JournalPhotoSnapshot {
  id: string;
  data_url: string;
}

export interface PasoSnapshot {
  version: string;
  schema_version?: number;
  app_version?: string;
  exported_at: string;
  profile: Profile;
  stats: Stats;
  visits: Visit[];
  reviews: Review[];
  pois: POI[];
  xp_log: XPLogEntry[];
  place_collections?: PlaceCollectionSnapshot[];
  media?: JournalPhotoSnapshot[];
  record_counts?: {
    pois: number;
    visits: number;
    reviews: number;
    xp_log: number;
    place_collections?: number;
    media?: number;
  };
  checksum?: string;
}

export interface DatabaseOptions {
  databaseName?: string;
  persistent?: boolean;
}

export type DatabaseStorageMode = "indexeddb" | "memory";

export interface PasoDatabase {
  sqlite3: SQLiteAPI;
  db: number;
  databaseName: string;
  storageMode: DatabaseStorageMode;
  close: () => Promise<void>;
}
