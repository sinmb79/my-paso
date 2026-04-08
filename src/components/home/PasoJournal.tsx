"use client";

import { useRef, useState, useTransition } from "react";

import {
  exportPasoSnapshot,
  restorePasoSnapshot,
} from "@/lib/export/json-export";
import type { PasoJournalController } from "@/hooks/usePasoJournal";

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[1.75rem] border border-stone-800 bg-stone-900/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PasoJournal({ model }: { model: PasoJournalController }) {
  const {
    status,
    error,
    pois,
    profile,
    stats,
    recentVisits,
    recentReviews,
    selectedPoi,
    selectedVisit,
    setSelectedPoiId,
    recordVisit,
    saveReview,
    database,
  } = model;
  const [memo, setMemo] = useState("");
  const [mood, setMood] = useState("curious");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [visitPending, startVisitTransition] = useTransition();
  const [reviewPending, startReviewTransition] = useTransition();
  const [exportPending, startExportTransition] = useTransition();
  const [importPending, startImportTransition] = useTransition();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = visitPending || reviewPending || exportPending || importPending;

  const handleRecordVisit = () => {
    if (!selectedPoi) {
      return;
    }

    startVisitTransition(() => {
      void (async () => {
        const now = new Date();
        const arrivedAt = new Date(now.getTime() - 12 * 60_000);
        const visit = await recordVisit({
          poiId: selectedPoi.id,
          arrivedAt: arrivedAt.toISOString(),
          departedAt: now.toISOString(),
          dwellTimeMinutes: 12,
          latitude: selectedPoi.latitude,
          longitude: selectedPoi.longitude,
          gpsAccuracyM: 18,
          memo: memo.trim() || undefined,
          mood,
        });

        setMemo("");
        setFeedback(
          `${selectedPoi.name} visit saved locally. ${visit.xp_earned} XP added.`,
        );
      })().catch((visitError: unknown) => {
        setFeedback(
          visitError instanceof Error
            ? visitError.message
            : "Visit recording failed.",
        );
      });
    });
  };

  const handleSaveReview = () => {
    if (!selectedPoi || !selectedVisit || !reviewText.trim()) {
      return;
    }

    startReviewTransition(() => {
      void (async () => {
        await saveReview({
          poiId: selectedPoi.id,
          visitId: selectedVisit.id,
          rating,
          text: reviewText.trim(),
          tags: ["local-first", selectedPoi.category],
        });

        setReviewText("");
        setFeedback(`${selectedPoi.name} review saved to the local notebook.`);
      })().catch((reviewError: unknown) => {
        setFeedback(
          reviewError instanceof Error
            ? reviewError.message
            : "Review saving failed.",
        );
      });
    });
  };

  const handleExport = () => {
    if (!database) {
      return;
    }

    startExportTransition(() => {
      void (async () => {
        const snapshot = await exportPasoSnapshot(database);
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `paso-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(objectUrl);
        setFeedback("Local snapshot exported as JSON.");
      })().catch((exportError: unknown) => {
        setFeedback(
          exportError instanceof Error
            ? exportError.message
            : "JSON export failed.",
        );
      });
    });
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportSnapshot = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !database) {
      return;
    }

    startImportTransition(() => {
      void (async () => {
        const payload = JSON.parse(await file.text());
        await restorePasoSnapshot(database, payload);
        await model.refresh();
        setFeedback(`Restored ${file.name} into the local journal.`);
      })().catch((importError: unknown) => {
        setFeedback(
          importError instanceof Error
            ? importError.message
            : "Snapshot restore failed.",
        );
      });
    });
  };

  if (status === "loading") {
    return (
      <SectionCard>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
          Local Journal
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          Bundled POIs, profile snapshot, and recent activity are preparing in
          local SQLite.
        </p>
      </SectionCard>
    );
  }

  if (status === "error") {
    return (
      <SectionCard className="border-red-500/40 bg-red-950/20">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
          Local Journal unavailable
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          {error?.message ?? "Local journal failed to load."}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <SectionCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
                Local Journal
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
                The local-first loop now works with bundled seed data only:
                visit logging, review writing, XP tracking, and JSON export.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportPending}
              className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportPending ? "Exporting..." : "Export local JSON"}
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={importPending}
              className="rounded-full border border-stone-700 px-4 py-2 text-sm font-medium text-stone-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importPending ? "Importing..." : "Import local JSON"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportSnapshot}
            />
          </div>
          {feedback ? (
            <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {feedback}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
                POI Explorer
              </h2>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                Pick a seeded POI to simulate the local visit and review loop.
              </p>
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-300/90">
              {pois.length} ready
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {pois.slice(0, 8).map((poi) => {
              const selected = poi.id === selectedPoi?.id;

              return (
                <button
                  key={poi.id}
                  type="button"
                  onClick={() => setSelectedPoiId(poi.id)}
                  className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                    selected
                      ? "border-amber-300 bg-amber-300/10"
                      : "border-stone-800 bg-stone-950/50 hover:border-stone-700"
                  }`}
                >
                  <p className="text-sm uppercase tracking-[0.2em] text-amber-300/80">
                    {poi.category.replaceAll("_", " ")}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-stone-50">
                    {poi.name}
                  </h3>
                  <p className="mt-2 text-sm text-stone-400">
                    {poi.region} / {poi.district}
                  </p>
                  <p className="mt-3 text-sm text-stone-300">
                    Base XP {poi.base_xp}
                  </p>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
            Visit Log
          </h2>
          <div className="mt-5 space-y-3">
            {recentVisits.length === 0 ? (
              <p className="text-sm leading-7 text-stone-300">
                No visits recorded yet. Use the logger on the right to create
                the first local visit.
              </p>
            ) : (
              recentVisits.map((visit) => (
                <article
                  key={visit.id}
                  className="rounded-[1.25rem] border border-stone-800 bg-stone-950/50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-50">
                        {visit.poi_name}
                      </h3>
                      <p className="mt-1 text-sm text-stone-400">
                        {formatDate(visit.arrived_at)}
                      </p>
                    </div>
                    <p className="rounded-full border border-amber-300/20 px-3 py-1 text-sm font-medium text-amber-200">
                      +{visit.xp_earned} XP
                    </p>
                  </div>
                  {visit.memo ? (
                    <p className="mt-3 text-sm leading-7 text-stone-300">
                      {visit.memo}
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
            Visit Logger
          </h2>
          {selectedPoi ? (
            <>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                Record a fast 12-minute local visit for{" "}
                <span className="font-medium text-stone-100">
                  {selectedPoi.name}
                </span>
                .
              </p>
              <textarea
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                rows={4}
                placeholder="Write a quick field note for this stop."
                className="mt-4 w-full rounded-[1.25rem] border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-300"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {["curious", "focused", "calm", "energized"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMood(option)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      mood === option
                        ? "border-amber-300 bg-amber-300/10 text-amber-100"
                        : "border-stone-800 text-stone-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRecordVisit}
                disabled={isBusy}
                className="mt-5 inline-flex rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-amber-300/40"
              >
                {visitPending ? "Recording..." : "Record local visit"}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Select a POI to start logging a visit.
            </p>
          )}
        </SectionCard>

        <SectionCard>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
            Review Studio
          </h2>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Attach a compact review to the most recent visit for the selected
            POI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`h-10 w-10 rounded-full border text-sm font-semibold ${
                  rating === value
                    ? "border-amber-300 bg-amber-300/10 text-amber-100"
                    : "border-stone-800 text-stone-300"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <textarea
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
            rows={4}
            placeholder={
              selectedVisit
                ? "Write a short local-first review for this visit."
                : "Record a visit first, then the review editor will unlock."
            }
            className="mt-4 w-full rounded-[1.25rem] border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-300"
          />
          <button
            type="button"
            onClick={handleSaveReview}
            disabled={isBusy || !selectedPoi || !selectedVisit || !reviewText.trim()}
            className="mt-5 inline-flex rounded-full border border-stone-700 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:border-stone-800 disabled:text-stone-500"
          >
            {reviewPending ? "Saving review..." : "Save local review"}
          </button>
        </SectionCard>

        <SectionCard>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
            Profile Snapshot
          </h2>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            {profile.nickname} / Level {stats.level}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Total XP", stats.total_xp],
              ["Visits", stats.total_visits],
              ["Unique POIs", stats.unique_pois_visited],
              ["Reviews", stats.total_reviews],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.25rem] border border-stone-800 bg-stone-950/50 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  {label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-stone-50">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
            Review Notebook
          </h2>
          <div className="mt-5 space-y-3">
            {recentReviews.length === 0 ? (
              <p className="text-sm leading-7 text-stone-300">
                No reviews yet. Record a visit and add the first note here.
              </p>
            ) : (
              recentReviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-[1.25rem] border border-stone-800 bg-stone-950/50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-50">
                        {review.poi_name}
                      </h3>
                      <p className="mt-1 text-sm text-stone-400">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <p className="rounded-full border border-amber-300/20 px-3 py-1 text-sm font-medium text-amber-200">
                      {review.rating}/5
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-stone-300">
                    {review.text}
                  </p>
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
