import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

import { LocalAIAssistantSheet } from "@/components/ai/LocalAIAssistantSheet";
import { LocalAISettings } from "@/components/ai/LocalAISettings";
import type { LocalAIDraft, LocalAISettings as LocalAISettingsValue } from "@/lib/ai/contracts";
import { loadLocalAISettings, saveLocalAISettings } from "@/lib/ai/preferences";
import * as localAIPreferences from "@/lib/ai/preferences";
import { useLocalAssistant } from "@/hooks/useLocalAssistant";

const assistantSheetMocks = vi.hoisted(() => ({
  sanitizePhotoForLocalAI: vi.fn().mockResolvedValue("data:image/jpeg;base64,c2FuaXRpemVk"),
}));

vi.mock("@/lib/ai/photo-sanitizer", () => ({
  sanitizePhotoForLocalAI: assistantSheetMocks.sanitizePhotoForLocalAI,
}));

const connectionResponse = () =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify({}) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const savedSettings = (model = "local-korean-model") => ({
  enabled: true,
  vendor: "naver" as const,
  endpoint: "http://127.0.0.1:8000",
  model,
  capability: "text" as const,
  confirmedPrivateLANEndpoint: null,
});

const visionSettings: LocalAISettingsValue = {
  ...savedSettings(),
  capability: "vision",
};

const generatedDraft: LocalAIDraft = {
  title: "돌담의 오후",
  body: "고요한 길을 천천히 걸었다.",
  category: "historic_site",
  keywords: ["돌담", "산책"],
  mood: "평온",
  altText: "오래된 돌담 옆으로 난 산책길",
  observations: ["회색 돌담이 보임", "나무 그림자가 길게 드리움"],
};

describe("LocalAIAssistantSheet", () => {
  beforeEach(() => {
    assistantSheetMocks.sanitizePhotoForLocalAI.mockClear();
  });

  it("shows the exact payload and privacy boundary before an explicit generation confirmation", async () => {
    const onGenerate = vi.fn().mockResolvedValue(generatedDraft);

    render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="돌담을 천천히 걸었다."
        photoDataUrl="data:image/jpeg;base64,b3JpZ2luYWw="
        settings={visionSettings}
        loading={false}
        error={null}
        onGenerate={onGenerate}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "로컬 AI 기록 도우미" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(
      Number(getComputedStyle(screen.getByRole("dialog").parentElement!).zIndex),
    ).toBeGreaterThan(50);
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByText("고요한 궁궐")).toBeInTheDocument();
    expect(screen.getByText("돌담을 천천히 걸었다.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "AI 전송 사진 미리보기" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,b3JpZ2luYWw=",
    );
    expect(screen.getByText("http://127.0.0.1:8000")).toBeInTheDocument();
    expect(screen.getByText(/이 기기 또는 브라우저의 localhost/)).toBeInTheDocument();
    expect(screen.getByText(/엔드포인트 운영자가 전송 내용을 볼 수 있어요/)).toBeInTheDocument();
    expect(screen.getByText(/EXIF를 제거한 임시 복사본만 전송/)).toBeInTheDocument();
    for (const excluded of ["정확한 위치", "사진 메타데이터", "다른 기록", "백업 데이터"]) {
      expect(screen.getByText(excluded)).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "기록 초안" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "분류와 키워드" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "사진 설명" })).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
    expect(assistantSheetMocks.sanitizePhotoForLocalAI).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));

    await waitFor(() =>
      expect(onGenerate).toHaveBeenCalledWith({
        intent: "journal_draft",
        placeName: "고요한 궁궐",
        note: "돌담을 천천히 걸었다.",
        imageDataUrl: expect.stringMatching(/^data:image\/(jpeg|webp);base64,/),
      }),
    );
    expect(assistantSheetMocks.sanitizePhotoForLocalAI).toHaveBeenCalledWith(
      "data:image/jpeg;base64,b3JpZ2luYWw=",
    );
  });

  it("visibly excludes a selected photo from a text-only request", async () => {
    const onGenerate = vi.fn().mockResolvedValue(generatedDraft);

    render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="텍스트 메모"
        photoDataUrl="data:image/jpeg;base64,b3JpZ2luYWw="
        settings={savedSettings()}
        loading={false}
        error={null}
        onGenerate={onGenerate}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByText(/텍스트 전용 모델이라 사진은 전송하지 않습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));

    await waitFor(() =>
      expect(onGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ imageDataUrl: null }),
      ),
    );
    expect(assistantSheetMocks.sanitizePhotoForLocalAI).not.toHaveBeenCalled();
  });

  it("does not start a request when the user cancels during transient photo sanitization", async () => {
    const sanitizing = deferred<string>();
    assistantSheetMocks.sanitizePhotoForLocalAI.mockReturnValueOnce(sanitizing.promise);
    const onGenerate = vi.fn().mockResolvedValue(generatedDraft);
    const onClose = vi.fn();

    render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="취소해도 남는 메모"
        photoDataUrl="data:image/jpeg;base64,b3JpZ2luYWw="
        settings={visionSettings}
        loading={false}
        error={null}
        onGenerate={onGenerate}
        onCancel={vi.fn()}
        onClose={onClose}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    await waitFor(() => expect(assistantSheetMocks.sanitizePhotoForLocalAI).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    sanitizing.resolve("data:image/jpeg;base64,c2FuaXRpemVk");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("aborts lifecycle work when unmounted during transient photo sanitization", async () => {
    const sanitizing = deferred<string>();
    assistantSheetMocks.sanitizePhotoForLocalAI.mockReturnValueOnce(sanitizing.promise);
    const onGenerate = vi.fn().mockResolvedValue(generatedDraft);
    const onCancel = vi.fn();
    const { unmount } = render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="언마운트 뒤에는 보내지 않을 메모"
        photoDataUrl="data:image/jpeg;base64,b3JpZ2luYWw="
        settings={visionSettings}
        loading={false}
        error={null}
        onGenerate={onGenerate}
        onCancel={onCancel}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    await waitFor(() => expect(assistantSheetMocks.sanitizePhotoForLocalAI).toHaveBeenCalledTimes(1));
    unmount();
    sanitizing.resolve("data:image/jpeg;base64,c2FuaXRpemVk");

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("aborts an already-started fetch signal when the sheet unmounts", async () => {
    const request = new AbortController();
    const onGenerate = vi.fn(
      () =>
        new Promise<LocalAIDraft>((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(request.signal.reason));
        }),
    );
    const onCancel = vi.fn(() => request.abort(new DOMException("cancelled", "AbortError")));
    const { unmount } = render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="요청 중인 메모"
        photoDataUrl={null}
        settings={savedSettings()}
        loading={false}
        error={null}
        onGenerate={onGenerate}
        onCancel={onCancel}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
    unmount();

    expect(request.signal.aborted).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("portals the modal, makes the background inert, traps focus, and restores exact state", async () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();
    const { container, rerender } = render(
      <>
        <button type="button">시트 열기 버튼</button>
        <LocalAIAssistantSheet
          open={false}
          placeName="고요한 궁궐"
          note="메모"
          photoDataUrl={null}
          settings={savedSettings()}
          loading={false}
          error={null}
          onGenerate={vi.fn().mockResolvedValue(generatedDraft)}
          onCancel={onCancel}
          onClose={onClose}
          onApply={vi.fn()}
        />
      </>,
    );
    container.setAttribute("aria-hidden", "false");
    container.setAttribute("inert", "legacy");
    const trigger = screen.getByRole("button", { name: "시트 열기 버튼" });
    trigger.focus();

    rerender(
      <>
        <button type="button">시트 열기 버튼</button>
        <LocalAIAssistantSheet
          open
          placeName="고요한 궁궐"
          note="메모"
          photoDataUrl={null}
          settings={savedSettings()}
          loading={false}
          error={null}
          onGenerate={vi.fn().mockResolvedValue(generatedDraft)}
          onCancel={onCancel}
          onClose={onClose}
          onApply={vi.fn()}
        />
      </>,
    );

    const dialog = await screen.findByRole("dialog", { name: "로컬 AI 기록 도우미" });
    expect(dialog.parentElement?.parentElement?.parentElement).toBe(document.body);
    expect(container).toHaveAttribute("inert", "");
    expect(container).toHaveAttribute("aria-hidden", "true");
    const first = screen.getByRole("button", { name: "닫기" });
    const last = screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <>
        <button type="button">시트 열기 버튼</button>
        <LocalAIAssistantSheet
          open={false}
          placeName="고요한 궁궐"
          note="메모"
          photoDataUrl={null}
          settings={savedSettings()}
          loading={false}
          error={null}
          onGenerate={vi.fn().mockResolvedValue(generatedDraft)}
          onCancel={onCancel}
          onClose={onClose}
          onApply={vi.fn()}
        />
      </>,
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(container).toHaveAttribute("inert", "legacy");
    expect(container).toHaveAttribute("aria-hidden", "false");
    expect(trigger).toHaveFocus();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("warns that selected content leaves this device for a private-LAN operator", async () => {
    const lanSettings: LocalAISettingsValue = {
      ...visionSettings,
      endpoint: "http://192.168.0.20:8000",
      confirmedPrivateLANEndpoint: "http://192.168.0.20:8000",
    };
    render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="사설망으로 보낼 메모"
        photoDataUrl="data:image/jpeg;base64,b3JpZ2luYWw="
        settings={lanSettings}
        loading={false}
        error={null}
        onGenerate={vi.fn().mockResolvedValue(generatedDraft)}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(await screen.findByText(/이 기기 밖으로 전송됩니다/)).toHaveTextContent(
      "사설망으로 보낼 메모",
    );
    expect(screen.getByText(/EXIF를 제거하고 크기를 줄인 임시 사진/)).toHaveTextContent(
      "http://192.168.0.20:8000",
    );
    expect(screen.getByText(/엔드포인트 운영자가 이 내용을 처리할 수 있습니다/)).toBeInTheDocument();
  });

  it("supports loading cancellation and an in-place retry without losing the preview", () => {
    const onCancel = vi.fn();
    const onGenerate = vi.fn();
    const { rerender } = render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="남아 있어야 할 메모"
        photoDataUrl={null}
        settings={visionSettings}
        loading
        error={null}
        onGenerate={onGenerate}
        onCancel={onCancel}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByText("초안을 만드는 중이에요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "생성 취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="남아 있어야 할 메모"
        photoDataUrl={null}
        settings={visionSettings}
        loading={false}
        error="모델에 연결할 수 없습니다."
        onGenerate={onGenerate}
        onCancel={onCancel}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("모델에 연결할 수 없습니다.");
    expect(screen.getByText("남아 있어야 할 메모")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ note: "남아 있어야 할 메모" }),
    );
  });

  it("lets every returned field be edited or selected before applying", async () => {
    const onApply = vi.fn();
    render(
      <LocalAIAssistantSheet
        open
        placeName="고요한 궁궐"
        note="메모"
        photoDataUrl={null}
        settings={visionSettings}
        loading={false}
        error={null}
        onGenerate={vi.fn().mockResolvedValue(generatedDraft)}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(screen.getByText("제목과 본문을 다듬어요")).toHaveClass("text-xs");
    fireEvent.click(screen.getByRole("button", { name: "이 내용으로 AI 초안 만들기" }));
    expect(await screen.findByDisplayValue("돌담의 오후")).toBeInTheDocument();
    expect(screen.getByText("적용 전 · 기기 메모리")).toHaveClass("text-xs");
    fireEvent.change(screen.getByLabelText("AI 제안 제목"), { target: { value: "수정한 제목" } });
    fireEvent.change(screen.getByLabelText("AI 제안 본문"), { target: { value: "수정한 본문" } });
    fireEvent.change(screen.getByLabelText("AI 제안 장소 분류"), { target: { value: "nature" } });
    fireEvent.change(screen.getByLabelText("AI 제안 기분"), { target: { value: "활력" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "키워드 산책 포함" }));
    fireEvent.change(screen.getByLabelText("AI 제안 사진 설명"), { target: { value: "수정한 설명" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "관찰 2 포함" }));
    fireEvent.click(screen.getByRole("button", { name: "초안 적용" }));

    expect(onApply).toHaveBeenCalledWith({
      title: "수정한 제목",
      body: "수정한 본문",
      category: "nature",
      keywords: ["돌담"],
      mood: "활력",
      altText: "수정한 설명",
      observations: ["회색 돌담이 보임"],
    });
  });
});

describe("LocalAISettings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.getByRole("checkbox", { name: "로컬 AI 사용" })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/localhost 또는 숫자로 된 사설망 IP 주소/);
    expect(screen.getByRole("checkbox", { name: "로컬 AI 사용" })).not.toBeChecked();
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

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://127.0.0.1:8000" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));
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

  it("never tests an obsolete saved runtime after the draft endpoint becomes invalid", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(connectionResponse());
    vi.stubGlobal("fetch", fetchImpl);
    render(<LocalAISettings onToast={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://127.0.0.1:8000" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));
    fireEvent.click(screen.getByRole("button", { name: "설정 저장" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "연결 테스트" })).toBeEnabled());

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "https://example.com" },
    });

    expect(screen.getByRole("checkbox", { name: "로컬 AI 사용" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "연결 테스트" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "연결 테스트" }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("gates testing when a saved runtime is changed to a new unconfirmed private LAN endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(connectionResponse());
    vi.stubGlobal("fetch", fetchImpl);
    render(<LocalAISettings onToast={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://127.0.0.1:8000" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));
    fireEvent.click(screen.getByRole("button", { name: "설정 저장" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "연결 테스트" })).toBeEnabled());

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://192.168.0.20:8000" },
    });

    expect(screen.getByRole("checkbox", { name: "로컬 AI 사용" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "연결 테스트" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "연결 테스트" }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("cancels an active connection test when the current draft becomes incompatible", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          requestSignal = init?.signal;
          requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason));
        }),
      ),
    );
    render(<LocalAISettings onToast={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "http://127.0.0.1:8000" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "로컬 AI 사용" }));
    fireEvent.click(screen.getByRole("button", { name: "설정 저장" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "연결 테스트" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "연결 테스트" }));
    await waitFor(() => expect(requestSignal).toBeDefined());

    fireEvent.change(screen.getByLabelText("로컬 실행 주소"), {
      target: { value: "https://example.com" },
    });

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    expect(screen.getByRole("button", { name: "연결 테스트" })).toBeDisabled();
  });
});

describe("useLocalAssistant", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("keeps the latest successful reload when an older load resolves later", async () => {
    const first = deferred<ReturnType<typeof savedSettings> | null>();
    const second = deferred<ReturnType<typeof savedSettings> | null>();
    const load = vi
      .spyOn(localAIPreferences, "loadLocalAISettings")
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useLocalAssistant());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => void result.current.reload());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve(savedSettings("latest")));
    expect(result.current.settings?.model).toBe("latest");

    await act(async () => first.resolve(savedSettings("stale")));
    expect(result.current.settings?.model).toBe("latest");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not let an older failed reload clear the newer loading state or error", async () => {
    const first = deferred<ReturnType<typeof savedSettings> | null>();
    const second = deferred<ReturnType<typeof savedSettings> | null>();
    const load = vi
      .spyOn(localAIPreferences, "loadLocalAISettings")
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useLocalAssistant());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => void result.current.reload());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await act(async () => first.reject(new Error("stale load failure")));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await act(async () => second.resolve(savedSettings("latest")));
    expect(result.current.settings?.model).toBe("latest");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("ignores a delayed load after unmount", async () => {
    const pending = deferred<ReturnType<typeof savedSettings> | null>();
    const load = vi.spyOn(localAIPreferences, "loadLocalAISettings").mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useLocalAssistant());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => pending.resolve(savedSettings("must-not-commit")));

    expect(result.current.settings).toBeNull();
  });
});
