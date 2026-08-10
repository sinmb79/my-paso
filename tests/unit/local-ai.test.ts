import { validateLocalAIEndpoint } from "@/lib/ai/endpoint-policy";
import { buildLocalAIRequest } from "@/lib/ai/context-builder";
import { validateLocalAIDraft } from "@/lib/ai/draft-validator";
import { LOCAL_AI_MODEL_CATALOG } from "@/lib/ai/model-catalog";
import { createOpenAICompatibleAssistant } from "@/lib/ai/openai-compatible";
import * as endpointPolicy from "@/lib/ai/endpoint-policy";
import type { LocalAISettings } from "@/lib/ai/contracts";

describe("local AI model catalog", () => {
  it("offers the four supported Korean vendor families with secure model-card links", () => {
    expect(LOCAL_AI_MODEL_CATALOG.map((item) => item.vendor)).toEqual([
      "naver",
      "kakao",
      "lg",
      "skt",
    ]);
    expect(
      LOCAL_AI_MODEL_CATALOG.every(
        (item) =>
          item.label.length > 0 &&
          item.textModel.length > 0 &&
          item.visionModel.length > 0 &&
          item.modelCardUrl.startsWith("https://") &&
          item.licenseNotice.length > 0,
      ),
    ).toBe(true);
  });

  it("identifies the SKT A.X preset as Apache-2.0 licensed", () => {
    const sktPreset = LOCAL_AI_MODEL_CATALOG.find((item) => item.vendor === "skt");

    expect(sktPreset?.licenseNotice).toMatch(/apache(?:\s+license)?\s*2\.0/i);
  });
});

describe("local AI endpoint policy", () => {
  it.each([
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://[::1]:8000",
  ])("accepts loopback endpoint %s", (endpoint) => {
    expect(validateLocalAIEndpoint(endpoint)).toMatchObject({
      ok: true,
      scope: "loopback",
    });
  });

  it("requires an exact renewed confirmation for a private IPv4 endpoint", () => {
    expect(validateLocalAIEndpoint("http://192.168.0.20:8000")).toMatchObject({
      ok: false,
      reason: "confirmation_required",
    });
    expect(
      validateLocalAIEndpoint(
        "http://192.168.0.20:8000",
        "http://192.168.0.20:8000",
      ),
    ).toMatchObject({ ok: true, scope: "private_lan" });
    expect(
      validateLocalAIEndpoint(
        "http://192.168.0.20:8000",
        "http://192.168.0.21:8000",
      ),
    ).toMatchObject({ ok: false, reason: "confirmation_required" });
  });

  it.each([
    "https://example.com/v1",
    "http://8.8.8.8:8000",
    "ftp://127.0.0.1:8000",
    "http://user:password@127.0.0.1:8000",
    "http://127.0.0.1:8000#fragment",
    "http://127.0.0.1:8000?token=secret",
    "http://runtime.local:8000",
    "http://2130706433:8000",
  ])("rejects unsafe endpoint %s", (endpoint) => {
    expect(validateLocalAIEndpoint(endpoint)).toMatchObject({ ok: false });
  });

  it.each([
    ["http://127.0.0.1:8000?", "query_not_allowed"],
    ["http://127.0.0.1:8000#", "fragment_not_allowed"],
  ] as const)("rejects a bare loopback delimiter in %s", (endpoint, reason) => {
    expect(validateLocalAIEndpoint(endpoint)).toMatchObject({ ok: false, reason });
  });

  it.each([
    ["http://192.168.0.20:8000?", "query_not_allowed"],
    ["http://192.168.0.20:8000#", "fragment_not_allowed"],
  ] as const)("rejects a bare private-LAN delimiter in %s", (endpoint, reason) => {
    expect(validateLocalAIEndpoint(endpoint, endpoint)).toMatchObject({
      ok: false,
      reason,
    });
  });

  it.each([
    "http://10.20.30.40:8000",
    "https://172.16.0.1:8000",
    "http://172.31.255.255:8000",
    "http://192.168.255.255:8000",
  ])("allows confirmed literal private IPv4 endpoint %s", (endpoint) => {
    expect(validateLocalAIEndpoint(endpoint, endpoint)).toMatchObject({
      ok: true,
      scope: "private_lan",
    });
  });

  it.each([
    "http://9.255.255.255:8000",
    "http://172.15.255.255:8000",
    "http://172.32.0.0:8000",
    "http://192.167.255.255:8000",
    "http://192.169.0.0:8000",
  ])("does not mistake a public IPv4 endpoint for private %s", (endpoint) => {
    expect(validateLocalAIEndpoint(endpoint, endpoint)).toMatchObject({ ok: false });
  });
});

describe("local AI request boundary", () => {
  it("builds a minimal JSON-only request without hidden journal metadata", () => {
    const request = buildLocalAIRequest({
      intent: "journal_draft",
      placeName: "천지연폭포",
      note: "물소리가 시원했다",
      imageDataUrl: null,
    });

    expect(JSON.stringify(request)).not.toMatch(
      /latitude|longitude|photoId|exif|backup/i,
    );
    expect(request.systemPrompt).toMatch(/[가-힣]/);
    expect(request.systemPrompt).toMatch(/하나의 JSON 객체/);
    expect(request.systemPrompt).toMatch(/관찰.*해석.*분리/);
    expect(request.systemPrompt).toMatch(/인물.*장소.*날짜.*이유.*사실/);
    expect(request.systemPrompt).toMatch(/제공.*입력.*만들어.*주장/);
    expect(request.input).toEqual({
      intent: "journal_draft",
      placeName: "천지연폭포",
      note: "물소리가 시원했다",
    });
  });
});

describe("local AI draft validation", () => {
  it("normalizes supported draft fields and drops unknown response keys", () => {
    expect(
      validateLocalAIDraft({
        title: "  기록  ",
        body: "  본문\n\n  ",
        category: "nature",
        keywords: [" 산책 ", "산책", "바람"],
        mood: "  평온함 ",
        altText: "  물가의 나무  ",
        observations: ["  물소리가 들린다  "],
        privateNote: "must not escape",
      }),
    ).toEqual({
      title: "기록",
      body: "본문",
      category: "nature",
      keywords: ["산책", "바람"],
      mood: "평온함",
      altText: "물가의 나무",
      observations: ["물소리가 들린다"],
    });
  });

  it("clamps long fields and filters an unknown category", () => {
    const validated = validateLocalAIDraft({
      title: "가".repeat(81),
      body: "나".repeat(1001),
      category: "invented_category",
      keywords: Array.from({ length: 10 }, (_, index) => `키워드${index}`.padEnd(30, "x")),
      mood: "다".repeat(25),
      altText: "라".repeat(241),
      observations: Array.from(
        { length: 6 },
        (_, index) => `${index}${"마".repeat(121)}`,
      ),
    });

    expect(validated).toMatchObject({
      title: "가".repeat(80),
      body: "나".repeat(1000),
      category: null,
      mood: "다".repeat(24),
      altText: "라".repeat(240),
    });
    expect(validated?.keywords).toHaveLength(8);
    expect(validated?.keywords.every((keyword) => keyword.length === 24)).toBe(true);
    expect(validated?.observations).toHaveLength(5);
    expect(
      validated?.observations.every((observation) => observation.length === 120),
    ).toBe(true);
  });

  it("rejects a response that is not an object", () => {
    expect(validateLocalAIDraft("not a draft")).toBeNull();
  });

  it("rejects an object without the required draft fields", () => {
    expect(validateLocalAIDraft({ privateNote: "not a draft" })).toBeNull();
    expect(
      validateLocalAIDraft({ title: "기록", body: "본문", keywords: "not an array" }),
    ).toBeNull();
  });
});

const localAISettings = (
  capability: LocalAISettings["capability"] = "text",
): LocalAISettings => ({
  enabled: true,
  vendor: "naver",
  endpoint: "http://127.0.0.1:8000",
  model: "local-korean-model",
  capability,
  confirmedPrivateLANEndpoint: null,
});

const jsonResponse = (value: unknown, status = 200): Response => {
  const body = JSON.stringify(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    json: vi.fn().mockResolvedValue(value),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
};

const draftChoice = (draft = { title: "초안", body: "본문", keywords: [] }): Response =>
  jsonResponse({ choices: [{ message: { content: JSON.stringify(draft) } }] });

function streamingResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  let index = 0;
  const reader = {
    read: vi.fn(async () => {
      if (index === chunks.length) {
        return { done: true, value: undefined };
      }
      const value = encoder.encode(chunks[index]);
      index += 1;
      return { done: false, value };
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  return {
    response: {
      ok: status >= 200 && status < 300,
      status,
      body: { getReader: () => reader },
      text: vi.fn(() => {
        throw new Error("unbounded text fallback must not be called");
      }),
      arrayBuffer: vi.fn(() => {
        throw new Error("unbounded arrayBuffer fallback must not be called");
      }),
    } as unknown as Response,
    reader,
  };
}

describe("OpenAI-compatible local assistant", () => {
  it("posts a text-only bounded request to the validated chat endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(draftChoice());
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings("text"),
      fetchImpl,
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: "천지연폭포",
        note: "물소리가 시원했다",
        imageDataUrl: "data:image/jpeg;base64,secret-photo",
      }),
    ).resolves.toMatchObject({ title: "초안", body: "본문" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/v1/chat/completions",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    const requestInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).has("authorization")).toBe(false);
    expect(requestInit.body).not.toContain("secret-photo");
  });

  it("includes the transient image only for a vision model", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(draftChoice());
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings("vision"),
      fetchImpl,
    });

    await assistant.generate({
      intent: "photo_alt",
      placeName: null,
      note: "나무가 보인다",
      imageDataUrl: "data:image/jpeg;base64,vision-copy",
    });

    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      body: expect.stringContaining("vision-copy"),
    });
  });

  it("revalidates endpoint policy immediately before fetch", async () => {
    const order: string[] = [];
    const original = endpointPolicy.validateLocalAIEndpoint;
    const policySpy = vi
      .spyOn(endpointPolicy, "validateLocalAIEndpoint")
      .mockImplementation((...args) => {
        order.push("validate");
        return original(...args);
      });
    const fetchImpl = vi.fn().mockImplementation(() => {
      order.push("fetch");
      return Promise.resolve(draftChoice());
    });
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl,
    });

    await assistant.generate({
      intent: "classify_keywords",
      placeName: null,
      note: "산책",
      imageDataUrl: null,
    });

    expect(order).toEqual(["validate", "fetch"]);
    policySpy.mockRestore();
  });

  it("uses a content-free chat request when testing the configured model", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(draftChoice());
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl,
    });

    await expect(assistant.testConnection()).resolves.toEqual({
      model: "local-korean-model",
    });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      body: expect.not.stringContaining("천지연폭포"),
    });
  });

  it("bounds an HTTP error without exposing an unlimited remote body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse("x".repeat(2_000), 500));
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl,
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      }),
    ).rejects.not.toThrow(/x{513}/);
  });

  it("rejects an empty choice list", async () => {
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ choices: [] })),
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      }),
    ).rejects.toThrow(/choice/i);
  });

  it("rejects invalid JSON returned by the runtime", async () => {
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "not-json" } }] }),
      ),
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      }),
    ).rejects.toThrow(/JSON/i);
  });

  it("rejects an oversized response body before processing ignored fields", async () => {
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: JSON.stringify({ title: "초안", body: "본문" }) } }],
          ignored: "x".repeat(50_000),
        }),
      ),
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      }),
    ).rejects.toThrow(/too large/i);
  });

  it("cancels an oversized streaming success body before buffering all chunks", async () => {
    const streamed = streamingResponse(["x".repeat(32_768), "x", "never read"]);
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl: vi.fn().mockResolvedValue(streamed.response),
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      }),
    ).rejects.toThrow(/too large/i);

    expect(streamed.reader.read).toHaveBeenCalledTimes(2);
    expect(streamed.reader.cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels an oversized streaming error body without buffering the remainder", async () => {
    const streamed = streamingResponse(["x".repeat(512), "x", "never read"], 500);
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl: vi.fn().mockResolvedValue(streamed.response),
    });

    await expect(
      assistant.generate({
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      }),
    ).rejects.toThrow(/^Local AI request failed \(500\): x{512}$/);

    expect(streamed.reader.read).toHaveBeenCalledTimes(2);
    expect(streamed.reader.cancel).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled request at the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl,
      timeoutMs: 25,
    });

    const pending = assistant.generate({
      intent: "journal_draft",
      placeName: null,
      note: "기록",
      imageDataUrl: null,
    });
    const timeoutExpectation = expect(pending).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(25);

    await timeoutExpectation;
    vi.useRealTimers();
  });

  it("preserves caller cancellation rather than replacing it with a timeout", async () => {
    const caller = new AbortController();
    const cancellation = new Error("caller cancelled");
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const assistant = createOpenAICompatibleAssistant({
      settings: localAISettings(),
      fetchImpl,
      timeoutMs: 5_000,
    });

    const pending = assistant.generate(
      {
        intent: "journal_draft",
        placeName: null,
        note: "기록",
        imageDataUrl: null,
      },
      caller.signal,
    );
    caller.abort(cancellation);

    await expect(pending).rejects.toBe(cancellation);
  });
});
