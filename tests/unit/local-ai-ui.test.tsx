import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

import { LocalAISettings } from "@/components/ai/LocalAISettings";
import { loadLocalAISettings, saveLocalAISettings } from "@/lib/ai/preferences";
import { useLocalAssistant } from "@/hooks/useLocalAssistant";

const connectionResponse = () =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify({}) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

describe("LocalAISettings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts disabled and offers all four owner-controlled vendor presets", () => {
    render(<LocalAISettings onToast={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "로컬 AI 사용" })).not.toBeChecked();
    expect(screen.getByRole("option", { name: /NAVER HyperCLOVA X SEED/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Kakao Kanana/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /LG AI Research EXAONE/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /SK Telecom A.X/ })).toBeInTheDocument();
  });

  it("blocks a public endpoint instead of persisting it", async () => {
    render(<LocalAISettings onToast={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));
    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "https://example.com" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/localhost 또는 숫자로 된 사설망 IP 주소/);
    expect(screen.getByRole("button", { name: "설정 저장" })).toBeDisabled();
    await expect(loadLocalAISettings()).resolves.toBeNull();
  });

  it("requires a confirmation tied to the exact private-LAN endpoint", () => {
    render(<LocalAISettings onToast={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://192.168.0.20:8000" },
    });

    expect(
      screen.getByText(/데이터가 이 기기를 떠날 수 있으며, 해당 엔드포인트 운영자가 내용을 볼 수 있습니다/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "설정 저장" })).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /192\.168\.0\.20:8000 엔드포인트를 내가 관리/ }),
    );

    expect(screen.getByText("내 사설망 기기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "설정 저장" })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://192.168.0.21:8000" },
    });

    expect(screen.getByRole("button", { name: "설정 저장" })).toBeDisabled();
  });

  it("links to the selected model card with safe external-link protections", () => {
    render(<LocalAISettings onToast={vi.fn()} />);

    const link = screen.getByRole("link", { name: /모델 카드와 라이선스/ });
    expect(link).toHaveAttribute("href", "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("tests only the selected model connection after settings are saved", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(connectionResponse());
    vi.stubGlobal("fetch", fetchImpl);
    const onToast = vi.fn();
    render(<LocalAISettings onToast={onToast} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));
    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://127.0.0.1:8000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "설정 저장" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "연결 테스트" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "연결 테스트" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const requestInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.body).toContain("HyperCLOVAX-SEED-Text-Instruct-0.5B");
    expect(requestInit.body).not.toContain("사용자가 쓴 짧은 메모");
  });
});

describe("useLocalAssistant", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cancels an in-flight request before replacing it and exposes no persistence API", async () => {
    await saveLocalAISettings({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "text",
      confirmedPrivateLANEndpoint: null,
    });
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) throw new Error("Expected hook-owned abort signal");
          signals.push(signal);
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
      ),
    );
    const { result } = renderHook(() => useLocalAssistant());

    await waitFor(() => expect(result.current.settings?.enabled).toBe(true));
    let firstResult: Promise<unknown> = Promise.resolve();
    let secondResult: Promise<unknown> = Promise.resolve();
    await act(async () => {
      firstResult = result.current.generate({
        intent: "journal_draft",
        placeName: null,
        note: "사용자가 쓴 짧은 메모",
        imageDataUrl: null,
      }).catch((error: unknown) => error);
    });
    await waitFor(() => expect(signals).toHaveLength(1));
    await act(async () => {
      secondResult = result.current.generate({
        intent: "journal_draft",
        placeName: null,
        note: "교체한 메모",
        imageDataUrl: null,
      }).catch((error: unknown) => error);
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(result.current).not.toHaveProperty("save");
    expect(result.current).not.toHaveProperty("recordVisit");
    act(() => result.current.cancel());
    await expect(firstResult).resolves.toBeInstanceOf(DOMException);
    await expect(secondResult).resolves.toBeInstanceOf(DOMException);
  });

  it("keeps loading saved settings after React Strict Mode replays effects", async () => {
    await saveLocalAISettings({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "text",
      confirmedPrivateLANEndpoint: null,
    });

    const { result } = renderHook(() => useLocalAssistant(), { reactStrictMode: true });

    await waitFor(() => expect(result.current.settings?.model).toBe("local-korean-model"));
  });
});
