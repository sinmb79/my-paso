import type { LocalAIDraft } from "./contracts";

const CATEGORIES = new Set<LocalAIDraft["category"]>([
  "cultural_heritage",
  "historic_site",
  "tourist_attraction",
  "nature",
  "food",
  "community",
  "custom",
  null,
]);

function normalizeText(value: unknown, maximumLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function normalizeNullableText(value: unknown, maximumLength: number): string | null {
  const normalized = normalizeText(value, maximumLength);
  return normalized || null;
}

function normalizeStrings(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    const text = normalizeText(item, maximumLength);
    const identity = text.toLocaleLowerCase();
    if (!text || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    normalized.push(text);
    if (normalized.length === maximumItems) {
      break;
    }
  }
  return normalized;
}

export function validateLocalAIDraft(value: unknown): LocalAIDraft | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== "string" ||
    typeof draft.body !== "string" ||
    !Array.isArray(draft.keywords)
  ) {
    return null;
  }
  const category = CATEGORIES.has(draft.category as LocalAIDraft["category"])
    ? (draft.category as LocalAIDraft["category"])
    : null;

  return {
    title: normalizeText(draft.title, 80),
    body: normalizeText(draft.body, 1000),
    category,
    keywords: normalizeStrings(draft.keywords, 8, 24),
    mood: normalizeNullableText(draft.mood, 24),
    altText: normalizeText(draft.altText, 240),
    observations: normalizeStrings(draft.observations, 5, 120),
  };
}
