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
  "반드시 하나의 JSON 객체만 반환하세요. title, body, category, keywords, mood, altText, observations 필드를 사용하세요.",
  "관찰한 내용과 해석을 분리하세요.",
  "사용자가 제공한 입력에 없는 인물, 장소, 날짜, 이유 또는 사실을 만들어 주장하지 마세요.",
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
