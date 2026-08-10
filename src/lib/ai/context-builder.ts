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
  "시각 입력은 직접 보이는 비식별 관찰에만 사용하세요.",
  "정확한 장소, 인물의 신원, 날짜와 시간, 소유 또는 관계, 이유, 역사적 사실은 placeName과 note에 제공된 텍스트에 있을 때만 주장하세요. 사진 단독으로 추론하거나 주장하지 마세요.",
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
