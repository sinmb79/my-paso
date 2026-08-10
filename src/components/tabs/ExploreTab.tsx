"use client";

import Image from "next/image";
import { useDeferredValue, useState, useTransition } from "react";

import { getPOICategoryLabel, getPOIMarkerColor } from "@/components/map/POIMarker";
import { withBasePath } from "@/lib/config/site";
import type { POICategory, PlaceSummary } from "@/types";

type ExploreTabProps = {
  pois: PlaceSummary[];
  selectedPoiId: string | null;
  onSelectPoi: (poiId: string) => void;
  onToggleSaved: (poiId: string, saved: boolean) => Promise<void>;
  onUpdateTags: (poiId: string, tags: string[]) => Promise<void>;
  onShowOnMap: (poiId: string) => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  canPersist?: boolean;
};

type StateFilter = "all" | "saved" | "visited";
const RESULT_PAGE_SIZE = 24;

const categories: Array<{ id: "all" | POICategory; label: string }> = [
  { id: "all", label: "전체" },
  { id: "cultural_heritage", label: "문화재" },
  { id: "historic_site", label: "사적지" },
  { id: "tourist_attraction", label: "관광지" },
  { id: "nature", label: "자연" },
  { id: "food", label: "맛집" },
  { id: "community", label: "커뮤니티" },
  { id: "custom", label: "기타" },
];

const stateFilters: Array<{ id: StateFilter; label: string }> = [
  { id: "all", label: "모든 장소" },
  { id: "saved", label: "저장한 장소" },
  { id: "visited", label: "방문한 장소" },
];

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? "currentColor" : "none"}>
      <path d="M6.75 3.75h10.5v16.5L12 16.8l-5.25 3.45V3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ExploreTab({
  pois,
  selectedPoiId,
  onSelectPoi,
  onToggleSaved,
  onUpdateTags,
  onShowOnMap,
  onToast,
  canPersist = true,
}: ExploreTabProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeCategory, setActiveCategory] = useState<"all" | POICategory>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [detailPoiId, setDetailPoiId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
  const [actionPending, startActionTransition] = useTransition();

  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const filteredPois = pois.filter((poi) => {
    if (activeCategory !== "all" && poi.category !== activeCategory) return false;
    if (stateFilter === "saved" && !poi.is_saved) return false;
    if (stateFilter === "visited" && !poi.is_visited) return false;
    if (!normalizedQuery) return true;

    return [
      poi.name,
      poi.description ?? "",
      poi.region,
      poi.district,
      ...poi.tags,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
  const detailPoi = detailPoiId
    ? pois.find((poi) => poi.id === detailPoiId) ?? null
    : null;
  const visiblePois = filteredPois.slice(0, visibleCount);

  const resetVisibleResults = () => setVisibleCount(RESULT_PAGE_SIZE);

  const runAction = (action: () => Promise<void>, successMessage: string) => {
    startActionTransition(() => {
      void action()
        .then(() => onToast(successMessage, "success"))
        .catch((error: unknown) => {
          onToast(error instanceof Error ? error.message : "변경사항을 저장하지 못했어요.", "error");
        });
    });
  };

  const toggleSaved = (poi: PlaceSummary) => {
    if (!canPersist) {
      onToast("영구 저장소를 사용할 수 있을 때 장소를 저장할 수 있어요.", "error");
      return;
    }
    runAction(
      () => onToggleSaved(poi.id, !poi.is_saved),
      poi.is_saved ? "저장한 장소에서 뺐어요." : "내 장소에 저장했어요.",
    );
  };

  const addTag = () => {
    if (!detailPoi || !tagInput.trim()) return;
    const nextTags = [...detailPoi.tags, tagInput.trim()];
    runAction(
      () => onUpdateTags(detailPoi.id, nextTags),
      "장소 태그를 저장했어요.",
    );
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    if (!detailPoi) return;
    runAction(
      () => onUpdateTags(detailPoi.id, detailPoi.tags.filter((item) => item !== tag)),
      "장소 태그를 정리했어요.",
    );
  };

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-4 pt-4"
      style={{ paddingBottom: "calc(var(--tab-height) + 1.25rem)" }}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] border px-4 py-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-10">
          <Image
            src={withBasePath("/brand/paso-memory-trail-light.webp")}
            alt=""
            fill
            priority
            unoptimized
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 520px"
          />
        </div>
        <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full" style={{ background: "radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)" }} />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--accent)" }}>
          My local atlas
        </p>
        <h2 className="relative mt-1 text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
          나만의 장소를 모아보세요
        </h2>
        <p className="relative mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          발견한 곳을 저장하고, 직접 붙인 태그와 방문의 기억으로 다시 찾습니다.
        </p>
      </div>

      <label className="mt-3 flex min-h-11 items-center gap-3 rounded-2xl border px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-tertiary)" }}>
        <SearchIcon />
        <input
          type="search"
          aria-label="장소 검색"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetVisibleResults();
          }}
          placeholder="이름, 지역, 내 태그로 검색"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:opacity-75"
          style={{ color: "var(--text-primary)" }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              resetVisibleResults();
            }}
            aria-label="검색어 지우기"
            className="text-lg leading-none"
          >
            &times;
          </button>
        ) : null}
      </label>

      <section
        aria-label="장소 필터"
        className="mt-3 overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="grid h-11 grid-cols-3 gap-1 p-1" style={{ backgroundColor: "var(--bg-secondary)" }}>
          {stateFilters.map((filter) => {
            const active = filter.id === stateFilter;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStateFilter(filter.id);
                  resetVisibleResults();
                }}
                className="min-w-0 rounded-xl px-2 text-xs font-bold transition"
                style={{
                  backgroundColor: active ? "var(--bg-card)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                  boxShadow: active ? "0 1px 5px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:thin]">
          {categories.map((category) => {
            const active = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setActiveCategory(category.id);
                  resetVisibleResults();
                }}
                className="h-11 shrink-0 rounded-full border px-3.5 text-xs font-bold transition"
                style={{
                  backgroundColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-contrast)" : "var(--text-secondary)",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                }}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {filteredPois.length}개의 장소
        </p>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          기기 안에서 검색됨
        </p>
      </div>

      {filteredPois.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {visiblePois.map((poi) => {
            const selected = poi.id === selectedPoiId;
            return (
              <article
                key={poi.id}
                className="relative overflow-hidden rounded-2xl border"
                style={{
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  backgroundColor: selected ? "var(--accent-bg)" : "var(--bg-card)",
                }}
              >
                <button
                  type="button"
                  aria-label={`${poi.name} 상세 보기`}
                  onClick={() => {
                    onSelectPoi(poi.id);
                    setDetailPoiId(poi.id);
                    setTagInput("");
                  }}
                  className="w-full p-4 pr-14 text-left transition active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getPOIMarkerColor(poi.category) }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                      {getPOICategoryLabel(poi.category)}
                    </span>
                    {poi.is_visited ? (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}>
                        {poi.visit_count}회 방문
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 line-clamp-1 text-base font-black" style={{ color: "var(--text-primary)" }}>
                    {poi.name}
                  </h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {poi.region} · {poi.district}
                  </p>
                  {poi.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {poi.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 line-clamp-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {poi.description ?? "이 장소에 나만의 태그를 붙여보세요."}
                    </p>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={poi.is_saved ? `${poi.name} 저장 해제` : `${poi.name} 저장`}
                  onClick={() => toggleSaved(poi)}
                  disabled={actionPending}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-50"
                  style={{
                    borderColor: poi.is_saved ? "var(--accent)" : "var(--border)",
                    backgroundColor: "var(--bg-card)",
                    color: poi.is_saved ? "var(--accent)" : "var(--text-tertiary)",
                  }}
                >
                  <BookmarkIcon filled={poi.is_saved} />
                </button>
              </article>
            );
          })}
          {visibleCount < filteredPois.length ? (
            <button
              type="button"
              aria-label={`더 보기 ${visiblePois.length}/${filteredPois.length}`}
              onClick={() => setVisibleCount((current) => current + RESULT_PAGE_SIZE)}
              className="rounded-2xl border px-4 py-4 text-sm font-black sm:col-span-2"
              style={{ borderColor: "var(--border)", color: "var(--accent)", backgroundColor: "var(--bg-card)" }}
            >
              장소 더 보기 · {visiblePois.length}/{filteredPois.length}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed px-5 py-10 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>조건에 맞는 장소가 없어요</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>검색어 또는 필터를 바꿔보세요.</p>
        </div>
      )}

      {detailPoi ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={detailPoi.name}>
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border p-5 shadow-2xl" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  {getPOICategoryLabel(detailPoi.category)} · {detailPoi.region}
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {detailPoi.name}
                </h3>
              </div>
              <button type="button" onClick={() => setDetailPoiId(null)} aria-label="장소 상세 닫기" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                &times;
              </button>
            </div>

            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
              {detailPoi.description ?? "아직 설명이 없는 장소입니다. 직접 방문한 뒤 첫 기억을 남겨보세요."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>나의 발자국</p>
                <p className="mt-1 font-black" style={{ color: "var(--text-primary)" }}>
                  {detailPoi.is_visited ? `${detailPoi.visit_count}번의 방문` : "아직 방문 전"}
                </p>
              </div>
              <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>기록 보상</p>
                <p className="mt-1 font-black" style={{ color: "var(--accent)" }}>{detailPoi.base_xp} XP</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>나만의 태그</h4>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{detailPoi.tags.length}/8</span>
              </div>
              <div className="mt-2 flex min-h-9 flex-wrap gap-2">
                {detailPoi.tags.length > 0 ? detailPoi.tags.map((tag) => (
                  <button key={tag} type="button" onClick={() => removeTag(tag)} aria-label={`${tag} 태그 삭제`} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}>
                    {tag} &times;
                  </button>
                )) : (
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>동행, 분위기, 다시 찾고 싶은 이유를 붙여보세요.</p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  aria-label="새 태그"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  maxLength={24}
                  placeholder="예: 노을, 부모님과"
                  className="min-w-0 flex-1 rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <button type="button" onClick={addTag} disabled={!tagInput.trim() || actionPending || !canPersist} className="rounded-xl px-4 text-sm font-black disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}>
                  태그 추가
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[0.85fr_1.15fr] gap-2">
              <button type="button" onClick={() => toggleSaved(detailPoi)} disabled={actionPending || !canPersist} className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-black disabled:opacity-50" style={{ borderColor: "var(--border)", color: detailPoi.is_saved ? "var(--accent)" : "var(--text-primary)" }}>
                <BookmarkIcon filled={detailPoi.is_saved} />
                {detailPoi.is_saved ? "저장 해제" : "장소 저장"}
              </button>
              <button type="button" onClick={() => onShowOnMap(detailPoi.id)} className="rounded-xl py-3 text-sm font-black" style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}>
                지도에서 보기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
