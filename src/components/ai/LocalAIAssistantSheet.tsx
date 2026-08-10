"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  LocalAIDraft,
  LocalAIIntent,
  LocalAIRequestPreview,
  LocalAISettings,
} from "@/lib/ai/contracts";
import { validateLocalAIEndpoint } from "@/lib/ai/endpoint-policy";
import { sanitizePhotoForLocalAI } from "@/lib/ai/photo-sanitizer";
import { withBasePath } from "@/lib/config/site";
import type { POICategory } from "@/types";

type LocalAIAssistantSheetProps = {
  open: boolean;
  placeName: string | null;
  note: string;
  photoDataUrl: string | null;
  settings: LocalAISettings;
  loading: boolean;
  error: string | null;
  onGenerate: (preview: LocalAIRequestPreview) => Promise<LocalAIDraft>;
  onCancel: () => void;
  onClose: () => void;
  onApply: (draft: LocalAIDraft) => void;
};

const intents: Array<{ value: LocalAIIntent; label: string; description: string }> = [
  { value: "journal_draft", label: "기록 초안", description: "제목과 본문을 다듬어요" },
  { value: "classify_keywords", label: "분류와 키워드", description: "나중에 찾기 쉽게 정리해요" },
  { value: "photo_alt", label: "사진 설명", description: "접근성 설명을 제안해요" },
];

const categories: Array<{ value: POICategory; label: string }> = [
  { value: "cultural_heritage", label: "문화유산" },
  { value: "historic_site", label: "역사 장소" },
  { value: "tourist_attraction", label: "관광 명소" },
  { value: "nature", label: "자연" },
  { value: "food", label: "음식" },
  { value: "community", label: "지역 공간" },
  { value: "custom", label: "직접 분류" },
];

const knownMoodLabels = ["호기심", "몰입", "평온", "활력"];
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function LocalAIAssistantSheet({
  open,
  placeName,
  note,
  photoDataUrl,
  settings,
  loading,
  error,
  onGenerate,
  onCancel,
  onClose,
  onApply,
}: LocalAIAssistantSheetProps) {
  const [intent, setIntent] = useState<LocalAIIntent>("journal_draft");
  const [draft, setDraft] = useState<LocalAIDraft | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<boolean[]>([]);
  const [selectedObservations, setSelectedObservations] = useState<boolean[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestGenerationRef = useRef(0);
  const cancellationNotifiedRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  const onCloseRef = useRef(onClose);
  onCancelRef.current = onCancel;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    cancellationNotifiedRef.current = false;
    setIntent("journal_draft");
    setDraft(null);
    setSelectedKeywords([]);
    setSelectedObservations([]);
    setLocalError(null);
    setLocalPending(false);

    const host = document.createElement("div");
    host.dataset.localAiDialogPortal = "";
    document.body.appendChild(host);
    setPortalHost(host);

    return () => {
      requestGenerationRef.current += 1;
      if (!cancellationNotifiedRef.current) {
        cancellationNotifiedRef.current = true;
        onCancelRef.current();
      }
      host.remove();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !portalHost) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const backgroundChildren = Array.from(document.body.children).filter(
      (child) => child !== portalHost,
    );
    const previousBackgroundState = backgroundChildren.map((element) => ({
      element,
      inert: element.getAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const { element } of previousBackgroundState) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestGenerationRef.current += 1;
        if (!cancellationNotifiedRef.current) {
          cancellationNotifiedRef.current = true;
          onCancelRef.current();
        }
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.tabIndex >= 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const { element, inert, ariaHidden } of previousBackgroundState) {
        if (inert === null) element.removeAttribute("inert");
        else element.setAttribute("inert", inert);
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      previousFocusRef.current?.focus();
    };
  }, [open, portalHost]);

  if (!open || !portalHost) return null;

  const includesPhoto = settings.capability === "vision" && Boolean(photoDataUrl);
  const displayedError = localError ?? error;
  const isGenerating = loading || localPending;
  const endpointValidation = validateLocalAIEndpoint(
    settings.endpoint,
    settings.confirmedPrivateLANEndpoint,
  );
  const isPrivateLan = endpointValidation.ok && endpointValidation.scope === "private_lan";
  const scopeLabel = isPrivateLan
    ? "내가 승인한 사설망 기기"
    : "이 기기 또는 브라우저의 localhost";
  const moodOptions = draft?.mood && !knownMoodLabels.includes(draft.mood)
    ? [draft.mood, ...knownMoodLabels]
    : knownMoodLabels;

  const cancelGeneration = () => {
    requestGenerationRef.current += 1;
    setLocalPending(false);
    if (!cancellationNotifiedRef.current) {
      cancellationNotifiedRef.current = true;
      onCancel();
    }
  };

  const close = () => {
    cancelGeneration();
    onClose();
  };

  const generate = async () => {
    cancellationNotifiedRef.current = false;
    const generation = ++requestGenerationRef.current;
    setLocalError(null);
    setDraft(null);
    setLocalPending(true);
    try {
      const imageDataUrl = includesPhoto && photoDataUrl
        ? await sanitizePhotoForLocalAI(photoDataUrl)
        : null;
      if (requestGenerationRef.current !== generation) return;
      const nextDraft = await onGenerate({
        intent,
        placeName,
        note,
        imageDataUrl,
      });
      if (requestGenerationRef.current !== generation) return;
      setDraft({ ...nextDraft });
      setSelectedKeywords(nextDraft.keywords.map(() => true));
      setSelectedObservations(nextDraft.observations.map(() => true));
    } catch (generationError) {
      if (requestGenerationRef.current === generation && !isAbortError(generationError)) {
        setLocalError(
          generationError instanceof Error
            ? generationError.message
            : "초안을 만들지 못했습니다.",
        );
      }
    } finally {
      if (requestGenerationRef.current === generation) {
        setLocalPending(false);
      }
    }
  };

  const applyDraft = () => {
    if (!draft) return;
    onApply({
      ...draft,
      keywords: draft.keywords.filter((_, index) => selectedKeywords[index]),
      observations: draft.observations.filter((_, index) => selectedObservations[index]),
    });
    requestGenerationRef.current += 1;
    if (!cancellationNotifiedRef.current) {
      cancellationNotifiedRef.current = true;
      onCancel();
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      style={{ zIndex: 70 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-ai-dialog-title"
        aria-describedby="local-ai-dialog-description"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[var(--surface-radius)] border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[var(--surface-shadow)] sm:max-w-2xl sm:rounded-[var(--surface-radius)] sm:p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <Image
          src={withBasePath("/brand/paso-memory-trail-light.webp")}
          alt=""
          aria-hidden="true"
          fill
          unoptimized
          className="pointer-events-none object-cover opacity-[0.08]"
          sizes="(max-width: 640px) 100vw, 672px"
        />
        <div className="relative">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
              로컬에서 초안 만들기
            </p>
            <h2 id="local-ai-dialog-title" className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>
              로컬 AI 기록 도우미
            </h2>
            <p id="local-ai-dialog-description" className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              아래에 보이는 내용만 전송합니다. 확인 전에는 어떤 요청도 보내지 않아요.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="닫기"
            onClick={close}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-2xl ${focusClass}`}
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
            <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>전송 미리보기</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold" style={{ color: "var(--text-tertiary)" }}>장소</dt>
                <dd className="mt-1 break-words" style={{ color: "var(--text-primary)" }}>{placeName || "선택한 장소 없음"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold" style={{ color: "var(--text-tertiary)" }}>짧은 메모</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words" style={{ color: "var(--text-primary)" }}>{note || "작성한 메모 없음"}</dd>
              </div>
            </dl>
            {photoDataUrl ? (
              <div className="mt-3">
                <Image
                  src={photoDataUrl}
                  alt="AI 전송 사진 미리보기"
                  width={480}
                  height={320}
                  unoptimized
                  className={`h-32 w-full rounded-xl object-cover ${includesPhoto ? "" : "opacity-45"}`}
                />
                <p className="mt-2 text-xs font-bold leading-relaxed" style={{ color: includesPhoto ? "var(--success)" : "var(--text-secondary)" }}>
                  {includesPhoto
                    ? "확인 후 EXIF를 제거한 임시 복사본만 전송합니다. 원본은 바꾸거나 저장하지 않아요."
                    : "텍스트 전용 모델이라 사진은 전송하지 않습니다. 사진 원본과 복사본 모두 요청에서 제외됩니다."}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>선택한 사진 없음</p>
            )}
          </section>

          <section className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))", backgroundColor: "var(--accent-bg)" }}>
            <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>연결 범위와 제외 항목</h3>
            <p className="mt-3 break-all rounded-xl px-3 py-2 text-xs font-bold" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
              {settings.endpoint}
            </p>
            <p className="mt-2 text-xs font-black" style={{ color: "var(--accent)" }}>{scopeLabel}</p>
            {isPrivateLan ? (
              <div className="mt-2 space-y-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <p>
                  장소 “{placeName || "선택한 장소 없음"}”와 메모 “{note || "작성한 메모 없음"}”는 이 기기 밖으로 전송됩니다. 표시된 엔드포인트 {settings.endpoint}로 이동합니다.
                </p>
                {includesPhoto ? (
                  <p>
                    EXIF를 제거하고 크기를 줄인 임시 사진도 이 기기 밖으로 전송되며 {settings.endpoint}에서 처리됩니다.
                  </p>
                ) : null}
                <p>엔드포인트 운영자가 이 내용을 처리할 수 있습니다.</p>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                선택한 내용은 이 기기의 loopback 연결 안에서만 처리됩니다.
              </p>
            )}
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              엔드포인트 운영자가 전송 내용을 볼 수 있어요. 본인이 소유하거나 신뢰하는 기기인지 확인해 주세요.
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              사진 전송이 포함될 때는 원본이 아니라 EXIF를 제거하고 크기를 줄인 임시 복사본만 사용합니다.
            </p>
            <p className="mt-3 text-xs font-black" style={{ color: "var(--text-primary)" }}>항상 제외</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
              {["정확한 위치", "사진 메타데이터", "다른 기록", "백업 데이터"].map((item) => (
                <li key={item} className="rounded-lg border px-2 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {!draft ? (
          <fieldset className="mt-5">
            <legend className="text-sm font-black" style={{ color: "var(--text-primary)" }}>무엇을 도와드릴까요?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {intents.map((item) => (
                <label key={item.value} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 ${focusClass}`} style={{ borderColor: intent === item.value ? "var(--accent)" : "var(--border)", backgroundColor: intent === item.value ? "var(--accent-bg)" : "var(--bg-secondary)" }}>
                  <input
                    type="radio"
                    aria-label={item.label}
                    name="local-ai-intent"
                    value={item.value}
                    checked={intent === item.value}
                    onChange={() => setIntent(item.value)}
                    className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-black" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--text-tertiary)" }}>{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {isGenerating ? (
          <div className="mt-5 rounded-2xl border px-4 py-5 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
            <p className="font-black" style={{ color: "var(--text-primary)" }}>초안을 만드는 중이에요</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>현재 입력은 그대로 유지됩니다.</p>
            <button type="button" onClick={cancelGeneration} className={`mt-3 min-h-11 rounded-xl border px-4 text-sm font-black ${focusClass}`} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              생성 취소
            </button>
          </div>
        ) : null}

        {displayedError && !isGenerating ? (
          <div role="alert" className="mt-5 rounded-2xl border px-4 py-4" style={{ borderColor: "var(--danger)", backgroundColor: "var(--danger-bg)", color: "var(--text-primary)" }}>
            <p className="text-sm font-black">초안을 만들지 못했어요</p>
            <p className="mt-1 text-xs leading-relaxed">{displayedError}</p>
            <button type="button" onClick={() => void generate()} className={`mt-3 min-h-11 rounded-xl border px-4 text-sm font-black ${focusClass}`} style={{ borderColor: "var(--danger)", backgroundColor: "var(--bg-card)" }}>
              다시 시도
            </button>
          </div>
        ) : null}

        {draft && !isGenerating ? (
          <section className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black" style={{ color: "var(--text-primary)" }}>AI 초안</h3>
              <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}>적용 전 · 기기 메모리</span>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>
                제목
                <input aria-label="AI 제안 제목" value={draft.title} maxLength={80} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={`mt-1 min-h-11 w-full rounded-xl border px-3 text-sm font-normal ${focusClass}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }} />
              </label>
              <label className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>
                본문
                <textarea aria-label="AI 제안 본문" value={draft.body} maxLength={1000} rows={4} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className={`mt-1 w-full resize-none rounded-xl border px-3 py-3 text-sm font-normal ${focusClass}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>
                  장소 분류
                  <select aria-label="AI 제안 장소 분류" value={draft.category ?? ""} onChange={(event) => setDraft({ ...draft, category: (event.target.value || null) as POICategory | null })} className={`mt-1 min-h-11 w-full rounded-xl border px-3 text-sm font-normal ${focusClass}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                    <option value="">적용하지 않음</option>
                    {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>
                  기분
                  <select aria-label="AI 제안 기분" value={draft.mood ?? ""} onChange={(event) => setDraft({ ...draft, mood: event.target.value || null })} className={`mt-1 min-h-11 w-full rounded-xl border px-3 text-sm font-normal ${focusClass}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                    <option value="">적용하지 않음</option>
                    {moodOptions.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
                  </select>
                </label>
              </div>
              {draft.keywords.length > 0 ? (
                <fieldset>
                  <legend className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>저장 후보 키워드</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.keywords.map((keyword, index) => (
                      <label key={`${keyword}-${index}`} className="flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-bold" style={{ borderColor: selectedKeywords[index] ? "var(--accent)" : "var(--border)", color: "var(--text-primary)" }}>
                        <input type="checkbox" aria-label={`키워드 ${keyword} 포함`} checked={Boolean(selectedKeywords[index])} onChange={() => setSelectedKeywords((current) => current.map((selected, currentIndex) => currentIndex === index ? !selected : selected))} className="h-5 w-5 accent-[var(--accent)]" />
                        {keyword}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <label className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>
                사진 설명
                <textarea aria-label="AI 제안 사진 설명" value={draft.altText} maxLength={240} rows={2} onChange={(event) => setDraft({ ...draft, altText: event.target.value })} className={`mt-1 w-full resize-none rounded-xl border px-3 py-3 text-sm font-normal ${focusClass}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }} />
              </label>
              {draft.observations.length > 0 ? (
                <fieldset>
                  <legend className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>사진에서 보인 점</legend>
                  <div className="mt-2 space-y-2">
                    {draft.observations.map((observation, index) => (
                      <label key={`${observation}-${index}`} className="flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                        <input type="checkbox" aria-label={`관찰 ${index + 1} 포함`} checked={Boolean(selectedObservations[index])} onChange={() => setSelectedObservations((current) => current.map((selected, currentIndex) => currentIndex === index ? !selected : selected))} className="h-5 w-5 accent-[var(--accent)]" />
                        {observation}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={close} className={`min-h-11 rounded-xl border px-4 text-sm font-black ${focusClass}`} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            취소
          </button>
          {draft ? (
            <button type="button" onClick={applyDraft} disabled={isGenerating} className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-45 ${focusClass}`} style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}>
              초안 적용
            </button>
          ) : (
            <button type="button" onClick={() => void generate()} disabled={isGenerating} className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-45 ${focusClass}`} style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}>
              이 내용으로 AI 초안 만들기
            </button>
          )}
        </div>
        </div>
      </section>
    </div>,
    portalHost,
  );
}
