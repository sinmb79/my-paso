"use client";

import { useEffect, useMemo, useState } from "react";

import type { LocalAICapability, LocalAISettings as LocalAISettingsValue } from "@/lib/ai/contracts";
import { validateLocalAIEndpoint } from "@/lib/ai/endpoint-policy";
import { LOCAL_AI_MODEL_CATALOG } from "@/lib/ai/model-catalog";
import { clearLocalAISettings, saveLocalAISettings } from "@/lib/ai/preferences";
import { useLocalAssistant } from "@/hooks/useLocalAssistant";

type LocalAISettingsProps = {
  onToast: (message: string, type?: "success" | "error" | "info") => void;
};

const defaultSettings = (): LocalAISettingsValue => ({
  enabled: false,
  vendor: "naver",
  endpoint: "",
  model: LOCAL_AI_MODEL_CATALOG[0].textModel,
  capability: "text",
  confirmedPrivateLANEndpoint: null,
});

const endpointErrors: Record<string, string> = {
  invalid_url: "로컬 실행 주소를 http:// 또는 https:// 주소로 입력하세요.",
  unsupported_scheme: "http:// 또는 https:// 주소만 사용할 수 있습니다.",
  credentials_not_allowed: "주소에 사용자 이름, 비밀번호 또는 API 키를 넣을 수 없습니다.",
  query_not_allowed: "주소의 쿼리 문자열은 사용할 수 없습니다.",
  fragment_not_allowed: "주소의 프래그먼트는 사용할 수 없습니다.",
  endpoint_path_not_allowed: "기본 주소만 입력하세요. /v1 경로는 자동으로 처리됩니다.",
  hostname_not_allowed: "localhost 또는 숫자로 된 사설망 IP 주소만 사용할 수 있습니다.",
  public_address_not_allowed: "공개 인터넷 주소는 사용할 수 없습니다.",
  confirmation_required: "사설망 기기 소유 확인이 필요합니다.",
};

function selectModel(settings: LocalAISettingsValue, capability: LocalAICapability) {
  const vendor = LOCAL_AI_MODEL_CATALOG.find((item) => item.vendor === settings.vendor)!;
  return capability === "vision" ? vendor.visionModel : vendor.textModel;
}

function settingsMatch(
  current: LocalAISettingsValue | null,
  draft: LocalAISettingsValue,
) {
  return current !== null &&
    current.enabled &&
    current.enabled === draft.enabled &&
    current.vendor === draft.vendor &&
    current.endpoint === draft.endpoint &&
    current.model === draft.model &&
    current.capability === draft.capability &&
    current.confirmedPrivateLANEndpoint === draft.confirmedPrivateLANEndpoint;
}

export function LocalAISettings({ onToast }: LocalAISettingsProps) {
  const { cancel, ...assistant } = useLocalAssistant();
  const [draft, setDraft] = useState<LocalAISettingsValue>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (assistant.settings) {
      setDraft(assistant.settings);
    }
  }, [assistant.settings]);

  const validation = useMemo(
    () => validateLocalAIEndpoint(draft.endpoint, draft.confirmedPrivateLANEndpoint),
    [draft.confirmedPrivateLANEndpoint, draft.endpoint],
  );
  const selectedModel = LOCAL_AI_MODEL_CATALOG.find((item) => item.vendor === draft.vendor)!;
  const validEndpoint = validation.ok;
  const privateEndpointNeedsConfirmation = !validation.ok && validation.reason === "confirmation_required";
  const endpointMessage = draft.endpoint.length > 0 && !validation.ok ? endpointErrors[validation.reason] : null;
  const currentDraftCanTest = validEndpoint && draft.enabled && settingsMatch(assistant.settings, draft);

  useEffect(() => {
    if (!currentDraftCanTest) {
      cancel();
    }
  }, [cancel, currentDraftCanTest]);

  const changeVendor = (vendor: LocalAISettingsValue["vendor"]) => {
    setDraft((current) => {
      const next = { ...current, vendor };
      return { ...next, model: selectModel(next, next.capability) };
    });
    setFormError(null);
  };

  const changeCapability = (capability: LocalAICapability) => {
    setDraft((current) => {
      const next = { ...current, capability };
      return { ...next, model: selectModel(next, capability) };
    });
    setFormError(null);
  };

  const changeEndpoint = (endpoint: string) => {
    setDraft((current) => {
      const next = { ...current, endpoint, confirmedPrivateLANEndpoint: null };
      return {
        ...next,
        enabled: validateLocalAIEndpoint(next.endpoint).ok ? current.enabled : false,
      };
    });
    setFormError(null);
  };

  const save = async () => {
    if (!validEndpoint) {
      setFormError(endpointMessage ?? "유효한 로컬 실행 주소를 확인하세요.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveLocalAISettings(draft);
      await assistant.reload();
      onToast("로컬 AI 설정을 이 기기에 저장했습니다.", "success");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "설정을 저장하지 못했습니다.";
      setFormError(message);
      onToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await clearLocalAISettings();
      setDraft(defaultSettings());
      await assistant.reload();
      onToast("저장된 로컬 AI 설정을 지웠습니다.", "success");
    } catch (clearError) {
      const message = clearError instanceof Error ? clearError.message : "설정을 지우지 못했습니다.";
      setFormError(message);
      onToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      const result = await assistant.testConnection();
      onToast(`${result.model} 연결을 확인했습니다. 기록 내용은 보내지 않았습니다.`, "success");
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : "연결을 확인하지 못했습니다.";
      onToast(message, "error");
    }
  };

  return (
    <section className="mt-6 rounded-[1.5rem] border p-4" aria-labelledby="local-ai-settings-title" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>Owner-controlled</p>
          <h3 id="local-ai-settings-title" className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>로컬 AI</h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>내 기기 또는 내가 확인한 사설망 실행기에만 연결합니다. API 키는 저장하거나 보내지 않습니다.</p>
        </div>
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={!validEndpoint}
            onChange={(event) => setDraft((current) => ({ ...current, enabled: validEndpoint && event.target.checked }))}
            aria-label="로컬 AI 사용"
          />
          사용
        </label>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          제공자 프리셋
          <select value={draft.vendor} onChange={(event) => changeVendor(event.target.value as LocalAISettingsValue["vendor"])} className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
            {LOCAL_AI_MODEL_CATALOG.map((item) => <option key={item.vendor} value={item.vendor}>{item.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          로컬 실행 주소
          <input value={draft.endpoint} onChange={(event) => changeEndpoint(event.target.value)} inputMode="url" placeholder="http://127.0.0.1:8000" className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: endpointMessage ? "var(--warning)" : "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }} />
        </label>

        {validation.ok ? <p className="rounded-xl px-3 py-2 text-xs font-bold" style={{ backgroundColor: "var(--accent-bg)", color: "var(--text-primary)" }}>{validation.scope === "loopback" ? "이 브라우저/기기에서 실행 (이 브라우저의 localhost)" : "내 사설망 기기"}</p> : null}
        {privateEndpointNeedsConfirmation ? <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-xs leading-relaxed" style={{ borderColor: "var(--warning)", color: "var(--text-secondary)" }}>
          <input type="checkbox" className="mt-0.5" checked={draft.confirmedPrivateLANEndpoint === draft.endpoint} onChange={(event) => setDraft((current) => ({ ...current, confirmedPrivateLANEndpoint: event.target.checked ? current.endpoint : null }))} aria-label={`${draft.endpoint.replace(/^https?:\/\//, "")} 엔드포인트를 내가 관리`} />
          <span>데이터가 이 기기를 떠날 수 있으며, 해당 엔드포인트 운영자가 내용을 볼 수 있습니다. 이 정확한 사설망 엔드포인트를 내가 관리함을 확인합니다.</span>
        </label> : null}
        {endpointMessage ? <p role="alert" className="text-xs leading-relaxed" style={{ color: "var(--warning)" }}>{endpointMessage}</p> : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1.5 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            기능
            <select value={draft.capability} onChange={(event) => changeCapability(event.target.value as LocalAICapability)} className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
              <option value="text">텍스트</option>
              <option value="vision">텍스트 + 사진</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            모델 ID
            <input value={draft.model} onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))} className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          </label>
        </div>

        <a href={selectedModel.modelCardUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>모델 카드와 라이선스 열기</a>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{selectedModel.licenseNotice} 모델 사용 권한과 실행 환경은 소유자가 확인해야 합니다.</p>

        {(formError ?? assistant.error) ? <p role="alert" className="text-xs leading-relaxed" style={{ color: "var(--warning)" }}>{formError ?? assistant.error}</p> : null}
        {assistant.loading && !saving ? <p role="status" className="text-xs" style={{ color: "var(--text-tertiary)" }}>로컬 AI 설정을 확인하는 중입니다…</p> : null}

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => void save()} disabled={saving || !validEndpoint} className="min-h-11 rounded-xl font-black disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}>설정 저장</button>
          <button type="button" onClick={() => void clear()} disabled={saving} className="min-h-11 rounded-xl border text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>설정 지우기</button>
          <button type="button" onClick={() => void testConnection()} disabled={saving || assistant.loading || !currentDraftCanTest} className="min-h-11 rounded-xl border text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>연결 테스트</button>
        </div>
      </div>
    </section>
  );
}
