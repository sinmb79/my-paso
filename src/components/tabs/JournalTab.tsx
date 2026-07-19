"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

import { getPOIMarkerColor } from "@/components/map/POIMarker";
import { StarRating } from "@/components/ui/StarRating";
import type { PasoJournalController } from "@/hooks/usePasoJournal";
import { getCurrentPosition, requestPermissions, type GPSPosition } from "@/lib/geo/gps-tracker";
import { haversineDistance } from "@/lib/geo/haversine";
import { buildJournalTimeline, findOnThisDayMemory } from "@/lib/journal/timeline";
import {
  deleteJournalPhoto,
  getJournalPhotoUrl,
  saveJournalPhoto,
} from "@/lib/media/photo-store";
import { takePhoto } from "@/lib/native/camera";

type JournalTabProps = {
  model: PasoJournalController;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  now?: Date;
};

type DraftPhoto = {
  id: string;
  dataUrl: string;
};

type LocationCheck =
  | { status: "idle" | "checking"; distance: null; position: null }
  | { status: "verified" | "outside"; distance: number; position: GPSPosition };

const moods = [
  { id: "curious", label: "호기심", color: "#0ea5e9" },
  { id: "focused", label: "몰입", color: "#ef4444" },
  { id: "calm", label: "평온", color: "#22c55e" },
  { id: "energized", label: "활력", color: "#f59e0b" },
];

function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDay(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function moodLabel(mood?: string) {
  return moods.find((item) => item.id === mood)?.label ?? null;
}

function StoredPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getJournalPhotoUrl(photoId).then((nextUrl) => {
      if (!cancelled) setUrl(nextUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [photoId]);

  if (!url) return null;
  return (
    <Image
      src={url}
      alt={alt}
      width={480}
      height={320}
      unoptimized
      className="h-32 w-full rounded-xl object-cover"
    />
  );
}

export function JournalTab({
  model,
  onToast,
  now = new Date(),
}: JournalTabProps) {
  const {
    selectedPoi,
    selectedVisit,
    recentVisits,
    recentReviews,
    recordVisit,
    saveReview,
  } = model;

  const [memo, setMemo] = useState("");
  const [mood, setMood] = useState("curious");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [capturePending, setCapturePending] = useState(false);
  const [locationCheck, setLocationCheck] = useState<LocationCheck>({
    status: "idle",
    distance: null,
    position: null,
  });
  const [visitPending, startVisitTransition] = useTransition();
  const [reviewPending, startReviewTransition] = useTransition();
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  const timeline = buildJournalTimeline(recentVisits, recentReviews);
  const anniversaryMemory = findOnThisDayMemory(recentVisits, now);
  const yearsAgo = anniversaryMemory
    ? now.getUTCFullYear() - new Date(anniversaryMemory.arrived_at).getUTCFullYear()
    : 0;
  const isBusy =
    visitPending ||
    reviewPending ||
    capturePending ||
    locationCheck.status === "checking";

  const handleCheckLocation = async () => {
    if (!selectedPoi) return;
    setLocationCheck({ status: "checking", distance: null, position: null });
    try {
      if (!(await requestPermissions())) {
        throw new Error("위치 권한이 필요합니다.");
      }
      const position = await getCurrentPosition();
      const distance = haversineDistance(
        position.coords.latitude,
        position.coords.longitude,
        selectedPoi.latitude,
        selectedPoi.longitude,
      );
      const accuracyAllowance = Math.min(position.coords.accuracy ?? 0, 50);
      const verified =
        distance <= selectedPoi.geofence_radius_m + accuracyAllowance;
      setLocationCheck({
        status: verified ? "verified" : "outside",
        distance,
        position,
      });
    } catch (error) {
      setLocationCheck({ status: "idle", distance: null, position: null });
      onToast(
        error instanceof Error ? error.message : "현재 위치를 확인하지 못했어요.",
        "error",
      );
    }
  };

  const handleAddPhoto = async () => {
    if (draftPhotos.length >= 4) {
      onToast("한 번의 방문에는 사진을 최대 4장까지 남길 수 있어요.", "info");
      return;
    }
    if (!model.canPersist) {
      onToast("영구 저장소를 사용할 수 있을 때 사진을 기록할 수 있어요.", "error");
      return;
    }

    setCapturePending(true);
    try {
      const dataUrl = await takePhoto();
      if (dataUrl) {
        setDraftPhotos((current) => [...current, { id: createDraftId(), dataUrl }]);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : "사진을 가져오지 못했어요.", "error");
    } finally {
      setCapturePending(false);
    }
  };

  const handleRecordVisit = () => {
    if (!selectedPoi) return;

    startVisitTransition(() => {
      void (async () => {
        const committedPhotoIds: string[] = [];
        try {
          for (const photo of draftPhotos) {
            const committed = await saveJournalPhoto(photo.dataUrl);
            committedPhotoIds.push(committed.id);
          }

          const recordedAt = new Date();
          const arrivedAt = new Date(recordedAt.getTime() - 12 * 60_000);
          const verifiedPosition =
            locationCheck.status === "verified" ? locationCheck.position : null;
          const visit = await recordVisit({
            poiId: selectedPoi.id,
            arrivedAt: arrivedAt.toISOString(),
            departedAt: recordedAt.toISOString(),
            dwellTimeMinutes: 12,
            latitude: verifiedPosition?.coords.latitude ?? selectedPoi.latitude,
            longitude: verifiedPosition?.coords.longitude ?? selectedPoi.longitude,
            gpsAccuracyM: verifiedPosition?.coords.accuracy ?? undefined,
            memo: memo.trim() || undefined,
            mood,
            photoIds: committedPhotoIds,
            verificationMode: verifiedPosition ? "gps" : "manual",
          });
          setMemo("");
          setDraftPhotos([]);
          setLocationCheck({ status: "idle", distance: null, position: null });
          onToast(`${selectedPoi.name} 방문을 기록했어요. +${visit.xp_earned} XP`, "success");
          reviewSectionRef.current?.scrollIntoView({ behavior: "smooth" });
        } catch (error) {
          await Promise.allSettled(committedPhotoIds.map(deleteJournalPhoto));
          throw error;
        }
      })().catch((error: unknown) => {
        onToast(error instanceof Error ? error.message : "방문 기록에 실패했어요.", "error");
      });
    });
  };

  const handleSaveReview = () => {
    if (!selectedPoi || !selectedVisit || !reviewText.trim()) return;

    startReviewTransition(() => {
      void saveReview({
        poiId: selectedPoi.id,
        visitId: selectedVisit.id,
        rating,
        text: reviewText.trim(),
        tags: selectedPoi.tags.slice(0, 4),
      })
        .then(() => {
          setReviewText("");
          onToast(`${selectedPoi.name} 감상을 저장했어요.`, "success");
        })
        .catch((error: unknown) => {
          onToast(error instanceof Error ? error.message : "감상을 저장하지 못했어요.", "error");
        });
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5" style={{ paddingBottom: "calc(var(--tab-height) + 1.25rem)" }}>
      <header className="relative overflow-hidden rounded-[1.75rem] border px-5 py-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div className="absolute -bottom-12 -right-4 h-32 w-32 rounded-full opacity-70" style={{ background: "radial-gradient(circle, var(--accent-bg), transparent 70%)" }} />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--accent)" }}>Private memory trail</p>
        <h2 className="relative mt-1 text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>오늘의 발자국을 남겨요</h2>
        <p className="relative mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>방문, 사진, 짧은 감상이 날짜를 따라 나만의 여행 기억이 됩니다.</p>
      </header>

      {anniversaryMemory ? (
        <section className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))", backgroundColor: "var(--accent-bg)" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-light), transparent)" }} />
          <div className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-black" style={{ color: "var(--text-primary)" }}>이날의 기억</h3>
              <span className="text-xs font-black" style={{ color: "var(--accent)" }}>{yearsAgo}년 전</span>
            </div>
            <p className="mt-2 text-base font-black" style={{ color: "var(--text-primary)" }}>{anniversaryMemory.poi_name}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{anniversaryMemory.memo ?? "그날의 방문 기록이 기기 안에 남아 있어요."}</p>
          </div>
        </section>
      ) : null}

      {selectedPoi ? (
        <section className="mt-4 rounded-[1.5rem] border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getPOIMarkerColor(selectedPoi.category) }} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-tertiary)" }}>지금 기록할 장소</p>
              <h3 className="truncate text-base font-black" style={{ color: "var(--text-primary)" }}>{selectedPoi.name}</h3>
            </div>
            <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}>{selectedPoi.base_xp} XP</span>
          </div>

          <textarea
            aria-label="방문 메모"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="그곳에서 눈에 들어온 것, 함께한 사람, 지금의 기분을 적어보세요."
            className="mt-4 w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-relaxed outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
          />

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {moods.map((item) => {
              const selected = mood === item.id;
              return (
                <button key={item.id} type="button" onClick={() => setMood(item.id)} className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: selected ? item.color : "var(--border)", backgroundColor: selected ? "var(--bg-secondary)" : "transparent", color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border px-3 py-3" style={{ borderColor: locationCheck.status === "verified" ? "var(--success)" : "var(--border)", backgroundColor: locationCheck.status === "verified" ? "var(--success-bg)" : "var(--bg-secondary)" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: locationCheck.status === "verified" ? "var(--success)" : "var(--bg-card)", color: locationCheck.status === "verified" ? "var(--bg-primary)" : "var(--text-tertiary)" }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.7"/></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
                {locationCheck.status === "verified"
                  ? "현장에서 확인됨"
                  : locationCheck.status === "outside"
                    ? "장소 범위 밖이에요"
                    : "수동 기록으로 저장됩니다"}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                {locationCheck.status === "verified" || locationCheck.status === "outside"
                  ? `장소 중심에서 약 ${locationCheck.distance}m`
                  : "현재 위치를 확인한 경우에만 GPS 인증 표시가 붙습니다."}
              </p>
            </div>
            <button type="button" onClick={() => void handleCheckLocation()} disabled={isBusy} className="shrink-0 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-40" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
              {locationCheck.status === "checking" ? "확인 중" : "현재 위치 확인"}
            </button>
          </div>

          {draftPhotos.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {draftPhotos.map((photo, index) => (
                <div key={photo.id} className="relative overflow-hidden rounded-xl">
                  <Image src={photo.dataUrl} alt={`방문 사진 미리보기 ${index + 1}`} width={360} height={240} unoptimized className="h-28 w-full object-cover" />
                  <button type="button" aria-label={`방문 사진 ${index + 1} 삭제`} onClick={() => setDraftPhotos((current) => current.filter((item) => item.id !== photo.id))} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-base text-white">&times;</button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-[0.85fr_1.15fr] gap-2">
            <button type="button" onClick={() => void handleAddPhoto()} disabled={isBusy || !model.canPersist || draftPhotos.length >= 4} className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-black disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4v-11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.7"/></svg>
              {capturePending ? "불러오는 중" : "사진 추가"}
            </button>
            <button type="button" onClick={handleRecordVisit} disabled={isBusy || !model.canPersist} className="rounded-xl py-3 text-sm font-black transition active:scale-[0.98] disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}>
              {visitPending ? "기록 중..." : "방문 기록하기"}
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-dashed px-5 py-10 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="font-black" style={{ color: "var(--text-primary)" }}>먼저 장소를 선택해 주세요</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>지도나 탐색 탭에서 오늘의 장소를 고를 수 있어요.</p>
        </section>
      )}

      {selectedPoi && selectedVisit ? (
        <section ref={reviewSectionRef} className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-black" style={{ color: "var(--text-primary)" }}>이 방문의 감상</h3>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>기기에만 저장</span>
          </div>
          <div className="mt-3"><StarRating value={rating} onChange={setRating} /></div>
          <textarea aria-label="방문 감상" value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={3} maxLength={1000} placeholder="다시 찾고 싶은 이유나 다음의 나에게 남길 말을 적어보세요." className="mt-3 w-full resize-none rounded-xl border px-4 py-3 text-sm leading-relaxed outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <button type="button" onClick={handleSaveReview} disabled={isBusy || !reviewText.trim() || !model.canPersist} className="mt-3 w-full rounded-xl border py-3 text-sm font-black disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-secondary)" }}>
            {reviewPending ? "저장 중..." : "감상 저장"}
          </button>
        </section>
      ) : null}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>Memory timeline</p>
            <h3 className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>나의 시간선</h3>
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{recentVisits.length}개의 발자국</p>
        </div>

        {timeline.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed px-5 py-10 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="font-black" style={{ color: "var(--text-primary)" }}>첫 발자국을 기다리고 있어요</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>방문을 기록하면 날짜를 따라 기억이 쌓입니다.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {timeline.map((day) => (
              <div key={day.dateKey}>
                <h4 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{formatDay(day.dateKey)}</h4>
                <div className="relative mt-3 space-y-3 pl-5 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-[var(--border)]">
                  {day.entries.map(({ visit, review }) => (
                    <article key={visit.id} className="relative rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
                      <span className="absolute -left-[1.27rem] top-5 h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--bg-primary)", backgroundColor: getPOIMarkerColor(visit.poi_category) }} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h5 className="truncate font-black" style={{ color: "var(--text-primary)" }}>{visit.poi_name}</h5>
                          <p className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>{formatTime(visit.arrived_at)}{moodLabel(visit.mood) ? ` · ${moodLabel(visit.mood)}` : ""}</p>
                        </div>
                        <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black" style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}>+{visit.xp_earned} XP</span>
                      </div>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-wider" style={{ color: visit.verification_mode === "gps" ? "var(--success)" : "var(--text-tertiary)" }}>
                        {visit.verification_mode === "gps" ? "GPS 확인 기록" : "수동 방문 기록"}
                      </p>
                      {visit.memo ? <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{visit.memo}</p> : null}
                      {visit.photo_ids.length > 0 ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {visit.photo_ids.slice(0, 4).map((photoId, index) => <StoredPhoto key={photoId} photoId={photoId} alt={`${visit.poi_name} 사진 ${index + 1}`} />)}
                        </div>
                      ) : null}
                      {review ? (
                        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                          <div className="text-xs tracking-wider" style={{ color: "var(--accent)" }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{review.text}</p>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
