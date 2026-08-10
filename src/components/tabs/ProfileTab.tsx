"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { LocalAISettings } from "@/components/ai/LocalAISettings";
import { APP_VERSION } from "@/lib/app-version";
import {
  exportPasoSnapshot,
  inspectPasoSnapshot,
  restorePasoSnapshot,
  type PasoSnapshotInspection,
} from "@/lib/export/json-export";
import type { PasoJournalController } from "@/hooks/usePasoJournal";
import { withBasePath } from "@/lib/config/site";
import {
  buildMonthlyRecap,
  computeMeaningfulAchievements,
  getLevelProgress,
} from "@/lib/journal/insights";
import {
  readBackupFile,
  writeBackupFile,
} from "@/lib/native/filesystem";
import { shareBackupFile } from "@/lib/native/share";

type ProfileTabProps = {
  model: PasoJournalController;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  now?: Date;
};

type PendingRestore = {
  fileName: string;
  inspection: PasoSnapshotInspection;
  payload: unknown;
};

const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const moodLabels: Record<string, string> = {
  curious: "호기심",
  focused: "몰입",
  calm: "평온",
  energized: "활력",
};

export function ProfileTab({ model, onToast, now = new Date() }: ProfileTabProps) {
  const { profile, stats, recentReviews, recentVisits, database } = model;
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [exportPending, startExportTransition] = useTransition();
  const [importPending, startImportTransition] = useTransition();
  const levelProgress = getLevelProgress(stats.total_xp);
  const monthlyRecap = buildMonthlyRecap(recentVisits, recentReviews, now);
  const achievements = computeMeaningfulAchievements({
    stats,
    places: model.pois,
    visits: recentVisits,
    reviews: recentReviews,
  });

  const handleExport = () => {
    if (!database) return;
    startExportTransition(() => {
      void (async () => {
        const snapshot = await exportPasoSnapshot(database);
        const fileName = `paso-backup-${new Date().toISOString().slice(0, 10)}.json`;
        const uri = await writeBackupFile(
          fileName,
          JSON.stringify(snapshot, null, 2),
        );
        let shared = false;

        if (uri) {
          try {
            shared = await shareBackupFile(uri, fileName);
          } catch {
            onToast("백업은 저장했지만 공유 창을 열지 못했어요.", "info");
            return;
          }
        }

        onToast(
          shared
            ? "백업을 저장하고 공유 창을 열었어요."
            : "백업 파일을 저장했어요.",
          "success",
        );
      })().catch((err: unknown) => {
        onToast(err instanceof Error ? err.message : "내보내기에 실패했어요.", "error");
      });
    });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !database) return;
    startImportTransition(() => {
      void (async () => {
        if (file.size > MAX_BACKUP_BYTES) {
          throw new Error("백업 파일은 100MB 이하여야 해요.");
        }

        const payload = JSON.parse(await readBackupFile(file)) as unknown;
        const inspection = await inspectPasoSnapshot(payload);
        if (!inspection.valid) {
          throw new Error(`백업 검증 실패: ${inspection.errors.join(" ")}`);
        }

        setPendingRestore({ fileName: file.name, inspection, payload });
      })().catch((err: unknown) => {
        onToast(err instanceof Error ? err.message : "백업을 읽지 못했어요.", "error");
      });
    });
  };

  const confirmRestore = () => {
    if (!database || !pendingRestore) return;

    startImportTransition(() => {
      void (async () => {
        await restorePasoSnapshot(database, pendingRestore.payload);
        await model.refresh();
        onToast(`${pendingRestore.fileName} 데이터를 복원했어요.`, "success");
        setPendingRestore(null);
      })().catch((err: unknown) => {
        onToast(err instanceof Error ? err.message : "복원에 실패했어요.", "error");
      });
    });
  };

  const statCards = [
    { label: "발자국", value: stats.total_visits },
    { label: "방문 장소", value: stats.unique_pois_visited },
    { label: "회고", value: stats.total_reviews },
    { label: "사진", value: stats.total_photos },
  ];

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-4 pt-5"
      style={{ paddingBottom: "calc(var(--tab-height) + 1.25rem)" }}
    >
      <section className="relative overflow-hidden rounded-[var(--surface-radius)] border px-5 py-5 text-[#fff8e7] shadow-[var(--surface-shadow)]" style={{ borderColor: "rgba(251,191,36,0.28)", backgroundColor: "var(--paso-night)" }}>
        <Image
          src={withBasePath("/brand/paso-memory-trail-dark-v2.webp")}
          alt=""
          aria-hidden="true"
          fill
          priority
          unoptimized
          className="pointer-events-none object-cover opacity-70"
          sizes="(max-width: 640px) 100vw, 520px"
        />
        <div className="absolute inset-0 bg-[#0c0a09]/45" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border text-xl font-black" style={{ borderColor: "rgba(253,230,138,0.28)", backgroundColor: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
            {profile.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/75">My Paso archive</p>
            <h2 className="truncate text-xl font-black tracking-tight">{profile.nickname}</h2>
            <p className="mt-1 text-xs font-bold text-amber-100/80">이 기기에 보관됨 · 계정 없음</p>
          </div>
        </div>
        <div className="relative mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-amber-100/65">현재 여정</p>
            <p className="mt-1 text-3xl font-black text-amber-300">Lv. {levelProgress.level}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{stats.total_xp.toLocaleString()}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-100/60">Total XP</p>
          </div>
        </div>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(3, levelProgress.progress * 100)}%` }} />
        </div>
        <p className="relative mt-2 text-right text-xs font-bold text-amber-100/70">다음 레벨까지 {levelProgress.xpToNext} XP</p>
      </section>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border px-2 py-3 text-center"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <p className="text-[10px] font-bold" style={{ color: "var(--text-tertiary)" }}>
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {monthlyRecap ? (
        <section className="mt-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>Monthly reflection</p>
          <h3 className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>{monthlyRecap.monthLabel}의 기억</h3>
          <div className="mt-3 overflow-hidden rounded-[1.5rem] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="grid grid-cols-3 divide-x border-b" style={{ borderColor: "var(--border)" }}>
              {[
                ["방문", monthlyRecap.visitCount],
                ["새로운 장소", monthlyRecap.uniquePlaceCount],
                ["사진", monthlyRecap.uniquePhotoCount],
              ].map(([label, value]) => (
                <div key={label} className="px-2 py-4 text-center" style={{ borderColor: "var(--border)" }}>
                  <p className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
                  <p className="mt-1 text-[10px] font-bold" style={{ color: "var(--text-tertiary)" }}>{label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>가장 자주 찾은 곳</p>
                <p className="mt-1 line-clamp-1 text-sm font-black" style={{ color: "var(--text-primary)" }}>{monthlyRecap.mostVisitedPlace ?? "아직 없음"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>이달의 기분</p>
                <p className="mt-1 text-sm font-black" style={{ color: "var(--text-primary)" }}>{monthlyRecap.topMood ? (moodLabels[monthlyRecap.topMood] ?? monthlyRecap.topMood) : "기록 전"}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>Earned by living</p>
            <h3 className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>여정의 이정표</h3>
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{achievements.filter((item) => item.earned).length}/{achievements.length} 달성</p>
        </div>
        <div className="mt-3 space-y-2.5">
          {achievements.map((item, index) => (
            <article key={item.id} className="relative overflow-hidden rounded-2xl border px-4 py-3.5" style={{ borderColor: item.earned ? "color-mix(in srgb, var(--accent) 50%, var(--border))" : "var(--border)", backgroundColor: "var(--bg-card)" }}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-black" style={{ borderColor: item.earned ? "var(--accent)" : "var(--border)", backgroundColor: item.earned ? "var(--accent-bg)" : "var(--bg-secondary)", color: item.earned ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-black" style={{ color: "var(--text-primary)" }}>{item.title}</h4>
                    <span className="shrink-0 text-xs font-black" style={{ color: item.earned ? "var(--accent)" : "var(--text-tertiary)" }}>{item.current} / {item.target}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.description}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-secondary)" }}><div className="h-full rounded-full" style={{ width: `${item.progress * 100}%`, backgroundColor: item.earned ? "var(--accent)" : "var(--text-tertiary)" }} /></div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-7 space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>Owner controls</p>
          <h3 className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>내 데이터 보관</h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>장소, 방문, 회고, 사진을 검사 가능한 로컬 백업으로 보관합니다.</p>
        </div>
        <LocalAISettings onToast={onToast} />
        <button
          type="button"
          onClick={handleExport}
          disabled={exportPending}
          className="w-full rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
        >
          {exportPending ? "내보내는 중..." : "데이터 내보내기 (JSON)"}
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={importPending || !model.canPersist}
          className="w-full rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
        >
          {importPending ? "복원 중..." : "데이터 가져오기 (JSON)"}
        </button>
        {!model.canPersist ? (
          <p className="text-xs leading-relaxed" style={{ color: "var(--warning)" }}>
            임시 메모리 모드에서는 안전을 위해 백업 복원을 시작할 수 없어요.
          </p>
        ) : null}
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImport}
        />
        <a
          href={withBasePath("/privacy.html")}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-xl border py-3 text-center text-sm font-semibold transition active:scale-[0.98]"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
        >
          개인정보처리방침
        </a>
        <p className="text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
          Hello! My Paso! v{APP_VERSION} &middot; Local-First
        </p>
      </div>

      {pendingRestore ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="backup-preview-title"
        >
          <div
            className="w-full max-w-md rounded-[1.75rem] border p-5 shadow-2xl"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  무결성 검사 통과
                </p>
                <h3 id="backup-preview-title" className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>
                  백업 확인
                </h3>
              </div>
              <button
                type="button"
                aria-label="백업 확인 닫기"
                onClick={() => setPendingRestore(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border text-lg"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                &times;
              </button>
            </div>

            <p className="mt-3 truncate text-sm" style={{ color: "var(--text-secondary)" }}>
              {pendingRestore.fileName}
            </p>
            {pendingRestore.inspection.exportedAt ? (
              <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                {formatDate(pendingRestore.inspection.exportedAt)} 백업
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                `${pendingRestore.inspection.recordCounts.pois}개 장소`,
                `${pendingRestore.inspection.recordCounts.visits}회 방문`,
                `${pendingRestore.inspection.recordCounts.reviews}개 리뷰`,
                `${pendingRestore.inspection.recordCounts.xp_log}개 XP 기록`,
                `${pendingRestore.inspection.recordCounts.place_collections}개 저장 정보`,
                `${pendingRestore.inspection.recordCounts.media}개 사진`,
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              className="mt-4 rounded-xl border px-3 py-3 text-xs leading-relaxed"
              style={{ borderColor: "var(--warning)", color: "var(--text-secondary)" }}
            >
              복원하면 현재 기기의 장소·방문·리뷰 기록이 이 백업 내용으로 교체됩니다. 검증 중 오류가 나면 기존 데이터는 그대로 유지됩니다.
            </div>

            <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="rounded-xl border py-3 text-sm font-bold"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                disabled={importPending}
                className="rounded-xl py-3 text-sm font-black disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {importPending ? "복원 중..." : "이 백업으로 복원"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
