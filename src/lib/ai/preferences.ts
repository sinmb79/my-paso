import type { LocalAICapability, LocalAISettings, LocalAIVendor } from "./contracts";
import { getSetting, removeSetting, setSetting } from "@/lib/native/preferences";

const LOCAL_AI_SETTINGS_KEY = "paso.local-ai.settings";
const VENDORS: readonly LocalAIVendor[] = ["naver", "kakao", "lg", "skt"];
const CAPABILITIES: readonly LocalAICapability[] = ["text", "vision"];

export async function loadLocalAISettings(): Promise<LocalAISettings | null> {
  const stored = await getSetting(LOCAL_AI_SETTINGS_KEY);
  if (!stored) {
    return null;
  }

  try {
    return toLocalAISettings(JSON.parse(stored));
  } catch {
    return null;
  }
}

export async function saveLocalAISettings(settings: LocalAISettings): Promise<void> {
  const approvedSettings = toLocalAISettings(settings);
  if (!approvedSettings) {
    throw new Error("Local AI settings are invalid.");
  }

  await setSetting(LOCAL_AI_SETTINGS_KEY, JSON.stringify(approvedSettings));
}

export async function clearLocalAISettings(): Promise<void> {
  await removeSetting(LOCAL_AI_SETTINGS_KEY);
}

function toLocalAISettings(value: unknown): LocalAISettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.enabled !== "boolean" ||
    !VENDORS.includes(candidate.vendor as LocalAIVendor) ||
    typeof candidate.endpoint !== "string" ||
    typeof candidate.model !== "string" ||
    !CAPABILITIES.includes(candidate.capability as LocalAICapability) ||
    (candidate.confirmedPrivateLANEndpoint !== null &&
      typeof candidate.confirmedPrivateLANEndpoint !== "string")
  ) {
    return null;
  }

  return {
    enabled: candidate.enabled,
    vendor: candidate.vendor as LocalAIVendor,
    endpoint: candidate.endpoint,
    model: candidate.model,
    capability: candidate.capability as LocalAICapability,
    confirmedPrivateLANEndpoint: candidate.confirmedPrivateLANEndpoint,
  };
}
