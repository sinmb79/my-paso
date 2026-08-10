import type { LocalAIIntent, LocalAIRequestPreview } from "./contracts";

export type LocalAIRequest = {
  systemPrompt: string;
  input: {
    intent: LocalAIIntent;
    placeName: string | null;
    note: string;
  };
  imageDataUrl: string | null;
};

const SYSTEM_PROMPT = [
  "Return one JSON object only, with title, body, category, keywords, mood, altText, and observations.",
  "Keep visible observations separate from interpretations.",
  "Do not assert a person, place, date, ownership, or historical fact unless it is supplied in the user's text.",
].join(" ");

export function buildLocalAIRequest(preview: LocalAIRequestPreview): LocalAIRequest {
  return {
    systemPrompt: SYSTEM_PROMPT,
    input: {
      intent: preview.intent,
      placeName: preview.placeName,
      note: preview.note,
    },
    imageDataUrl: preview.imageDataUrl,
  };
}
