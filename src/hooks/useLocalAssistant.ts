"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LocalAIDraft, LocalAIRequestPreview, LocalAISettings } from "@/lib/ai/contracts";
import { createOpenAICompatibleAssistant } from "@/lib/ai/openai-compatible";
import { loadLocalAISettings } from "@/lib/ai/preferences";

type LocalAssistantState = {
  settings: LocalAISettings | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  testConnection: () => Promise<{ model: string }>;
  generate: (preview: LocalAIRequestPreview) => Promise<LocalAIDraft>;
  cancel: () => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "로컬 AI 요청을 완료하지 못했습니다.";
}

export function useLocalAssistant(): LocalAssistantState {
  const [settings, setSettings] = useState<LocalAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const cancel = useCallback(() => {
    const activeController = activeControllerRef.current;
    activeControllerRef.current = null;
    activeController?.abort(new DOMException("Local AI request cancelled.", "AbortError"));
    if (mountedRef.current) {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const loadedSettings = await loadLocalAISettings();
      if (mountedRef.current) {
        setSettings(loadedSettings);
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setSettings(null);
        setError(errorMessage(loadError));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => {
      mountedRef.current = false;
      const activeController = activeControllerRef.current;
      activeControllerRef.current = null;
      activeController?.abort(new DOMException("Local AI request cancelled.", "AbortError"));
    };
  }, [reload]);

  const run = useCallback(
    async <T,>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      if (!settings?.enabled) {
        const unavailable = new Error("로컬 AI를 사용하려면 유효한 설정을 저장하고 사용을 켜세요.");
        if (mountedRef.current) {
          setError(unavailable.message);
        }
        throw unavailable;
      }

      const previousController = activeControllerRef.current;
      previousController?.abort(new DOMException("Local AI request replaced.", "AbortError"));
      const controller = new AbortController();
      activeControllerRef.current = controller;
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        return await operation(controller.signal);
      } catch (operationError) {
        if (mountedRef.current && activeControllerRef.current === controller) {
          setError(errorMessage(operationError));
        }
        throw operationError;
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      }
    },
    [settings],
  );

  const testConnection = useCallback(
    () =>
      run((signal) =>
        createOpenAICompatibleAssistant({ settings: settings! }).testConnection(signal),
      ),
    [run, settings],
  );

  const generate = useCallback(
    (preview: LocalAIRequestPreview) =>
      run((signal) =>
        createOpenAICompatibleAssistant({ settings: settings! }).generate(preview, signal),
      ),
    [run, settings],
  );

  return { settings, loading, error, reload, testConnection, generate, cancel };
}
