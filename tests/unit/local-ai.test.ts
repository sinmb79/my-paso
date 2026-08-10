import { validateLocalAIEndpoint } from "@/lib/ai/endpoint-policy";
import { buildLocalAIRequest } from "@/lib/ai/context-builder";
import { validateLocalAIDraft } from "@/lib/ai/draft-validator";
import { LOCAL_AI_MODEL_CATALOG } from "@/lib/ai/model-catalog";
import { createOpenAICompatibleAssistant } from "@/lib/ai/openai-compatible";
import * as endpointPolicy from "@/lib/ai/endpoint-policy";
import * as nativePreferences from "@/lib/native/preferences";
import { loadLocalAISettings, saveLocalAISettings, clearLocalAISettings } from "@/lib/ai/preferences";
import { sanitizePhotoForLocalAI } from "@/lib/ai/photo-sanitizer";
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
    "https://localhost:8000",
    "http://127.0.0.1:8000",
    "https://127.0.0.1:8000",
    "http://[::1]:8000",
    "https://[::1]:8000",
  ])("accepts loopback endpoint %s", (endpoint) => {
    expect(validateLocalAIEndpoint(endpoint)).toMatchObject({
      ok: true,
      scope: "loopback",
    });
  });

  it("rejects HTTP private IPv4 before ownership confirmation", () => {
    expect(validateLocalAIEndpoint("http://192.168.0.20:8000")).toMatchObject({
      ok: false,
      reason: "private_lan_https_required",
    });
    expect(
      validateLocalAIEndpoint(
        "http://192.168.0.20:8000",
        "http://192.168.0.20:8000",
      ),
    ).toMatchObject({ ok: false, reason: "private_lan_https_required" });
  });

  it("requires an exact renewed confirmation for an HTTPS private IPv4 endpoint", () => {
    expect(validateLocalAIEndpoint("https://192.168.0.20:8000")).toMatchObject({
      ok: false,
      reason: "confirmation_required",
    });
    expect(
      validateLocalAIEndpoint(
        "https://192.168.0.20:8000",
        "https://192.168.0.20:8000",
      ),
    ).toMatchObject({ ok: true, scope: "private_lan" });
    expect(
      validateLocalAIEndpoint(
        "https://192.168.0.20:8000",
        "https://192.168.0.21:8000",
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
    ["https://192.168.0.20:8000?", "query_not_allowed"],
    ["https://192.168.0.20:8000#", "fragment_not_allowed"],
  ] as const)("rejects a bare private-LAN delimiter in %s", (endpoint, reason) => {
    expect(validateLocalAIEndpoint(endpoint, endpoint)).toMatchObject({
      ok: false,
      reason,
    });
  });

  it.each([
    "https://10.20.30.40:8000",
    "https://172.16.0.1:8000",
    "https://172.31.255.255:8000",
    "https://192.168.255.255:8000",
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
    expect(request.systemPrompt).toMatch(/시각.*입력.*직접.*보이는.*비식별.*관찰/);
    expect(request.systemPrompt).toMatch(/장소.*인물.*날짜.*시간.*소유.*관계.*이유.*역사.*사실/);
    expect(request.systemPrompt).toMatch(/placeName.*note.*제공.*텍스트/);
    expect(request.systemPrompt).toMatch(/사진.*단독.*추론.*주장.*마세요/);
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

describe("local AI photo sanitizer", () => {
  const originalCreateElement = document.createElement.bind(document);

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["image/jpeg", "image/png", "image/webp"] as const)(
    "accepts a supported %s data URL",
    async (mimeType) => {
      installPhotoSanitizerDomDouble(2400, 1600);

      await expect(
        sanitizePhotoForLocalAI(photoDataUrl(mimeType, 2400, 1600)),
      ).resolves.toBe("data:image/jpeg;base64,sanitized-photo");
    },
  );

  it.each([
    "data:image/gif;base64,R0lGODlh",
    "data:image/jpeg,missing-base64-marker",
    "data:image/jpeg;base64,not valid base64!",
    "data:image/jpeg;base64,A",
    "data:image/jpeg;base64,A=",
    "data:image/jpeg;base64,AA=",
    "data:image/jpeg;base64,AAAA=",
    "data:image/jpeg;base64,AAAA==",
    "not-a-data-url",
  ])("rejects unsupported or malformed image input %s", async (input) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(2400, 1600);

    await expect(sanitizePhotoForLocalAI(input)).rejects.toThrow(/photo/i);
    expect(assignedSources).toEqual([]);
  });

  it("re-encodes a fresh bounded canvas without mutating or persisting the original input", async () => {
    const { canvas, drawImage } = installPhotoSanitizerDomDouble(2400, 1600);
    const input = photoDataUrl("image/png", 2400, 1600);

    await expect(sanitizePhotoForLocalAI(input)).resolves.toBe(
      "data:image/jpeg;base64,sanitized-photo",
    );

    expect(input).toBe(photoDataUrl("image/png", 2400, 1600));
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(853);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 853);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.82);
    expect(localStorage.length).toBe(0);
  });

  it("accepts the largest canonical encoded Data URL within the documented 16 MiB limit", async () => {
    const { assignedSources } = installPhotoSanitizerDomDouble(1, 1);
    const header = bytesToBase64(pngBytes(1, 1));
    const payloadLength =
      Math.floor((16 * 1024 * 1024 - "data:image/png;base64,".length) / 4) * 4;
    const input = `data:image/png;base64,${header}${"A".repeat(payloadLength - header.length)}`;

    await expect(sanitizePhotoForLocalAI(input)).resolves.toBe(
      "data:image/jpeg;base64,sanitized-photo",
    );
    expect(assignedSources).toHaveLength(1);
  });

  it("rejects an oversized encoded Data URL before Base64 decoding or image assignment", async () => {
    const { assignedSources } = installPhotoSanitizerDomDouble(1, 1);
    const decode = vi.fn(() => {
      throw new Error("Base64 decoder must not run");
    });
    vi.stubGlobal("atob", decode);
    const input = `data:image/png;base64,${"A".repeat(16 * 1024 * 1024)}`;

    await expect(sanitizePhotoForLocalAI(input)).rejects.toThrow(/too large/i);
    expect(decode).not.toHaveBeenCalled();
    expect(assignedSources).toEqual([]);
  });

  it.each([
    ["image/png", 8193, 1],
    ["image/jpeg", 1, 8193],
    ["image/webp", 8000, 5001],
  ] as const)(
    "rejects unsafe %s source dimensions %s by %s before image assignment",
    async (mimeType, width, height) => {
      const { assignedSources } = installPhotoSanitizerDomDouble(width, height);

      await expect(
        sanitizePhotoForLocalAI(photoDataUrl(mimeType, width, height)),
      ).rejects.toThrow(/dimension|pixel|photo/i);
      expect(assignedSources).toEqual([]);
    },
  );

  it.each(["image/png", "image/jpeg", "image/webp"] as const)(
    "reads valid %s header dimensions before using the browser decoder",
    async (mimeType) => {
      const { assignedSources } = installPhotoSanitizerDomDouble(8000, 5000);

      await expect(
        sanitizePhotoForLocalAI(photoDataUrl(mimeType, 8000, 5000)),
      ).resolves.toBe("data:image/jpeg;base64,sanitized-photo");
      expect(assignedSources).toHaveLength(1);
    },
  );

  it.each([
    (() => {
      const bytes = pngBytes(1, 1);
      bytes[11] = 12;
      return ["data:image/png;base64," + bytesToBase64(bytes)];
    })(),
    (() => {
      const bytes = webpVp8xBytes(1, 1);
      bytes[16] = 0;
      return ["data:image/webp;base64," + bytesToBase64(bytes)];
    })(),
  ])("rejects a malformed declared image header before image assignment", async (input) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(1, 1);

    await expect(sanitizePhotoForLocalAI(input)).rejects.toThrow(/photo|dimension/i);
    expect(assignedSources).toEqual([]);
  });

  it.each([
    (() => {
      const bytes = webpVp8Bytes(1, 1);
      setUint32LittleEndian(bytes, 16, 11);
      return ["overdeclared VP8", bytes];
    })(),
    (() => {
      const bytes = webpVp8lBytes(1, 1);
      setUint32LittleEndian(bytes, 16, 7);
      return ["overdeclared VP8L", bytes];
    })(),
    (() => {
      const bytes = webpVp8xBytes(1, 1);
      setUint32LittleEndian(bytes, 16, 12);
      return ["overdeclared VP8X", bytes];
    })(),
    (() => {
      const bytes = webpVp8xBytes(1, 1);
      setUint32LittleEndian(bytes, 4, bytes.length);
      return ["overdeclared RIFF container", bytes];
    })(),
    (() => ["truncated VP8L padding", webpVp8lBytes(1, 1).slice(0, -1)])(),
    (() => {
      const bytes = webpVp8xBytes(1, 1);
      return ["padded trailing container", new Uint8Array([...bytes, 0])];
    })(),
  ])("rejects %s WebP before image assignment", async (_kind, bytes) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(1, 1);

    await expect(
      sanitizePhotoForLocalAI(`data:image/webp;base64,${bytesToBase64(bytes)}`),
    ).rejects.toThrow(/photo|dimension/i);
    expect(assignedSources).toEqual([]);
  });

  it.each([
    ["JPEG SOF2", "data:image/jpeg;base64," + bytesToBase64(jpegBytes(2400, 1600, 0xc2))],
    ["WebP VP8", "data:image/webp;base64," + bytesToBase64(webpVp8Bytes(2400, 1600))],
    ["WebP VP8L", "data:image/webp;base64," + bytesToBase64(webpVp8lBytes(2400, 1600))],
    ["WebP VP8X", "data:image/webp;base64," + bytesToBase64(webpVp8xBytes(2400, 1600))],
  ])("recognizes dimensions from a valid %s header", async (_kind, input) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(2400, 1600);

    await expect(sanitizePhotoForLocalAI(input)).resolves.toBe(
      "data:image/jpeg;base64,sanitized-photo",
    );
    expect(assignedSources).toEqual([input]);
  });

  it.each([
    [
      "VP8X with alpha and VP8",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(2400, 1600, 0x10) },
        { type: "ALPH", payload: [0] },
        { type: "VP8 ", payload: vp8Payload(2400, 1600) },
      ]),
    ],
    [
      "VP8X with VP8L",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(2400, 1600) },
        { type: "VP8L", payload: vp8lPayload(2400, 1600) },
      ]),
    ],
    [
      "VP8X with VP8L alpha agreement",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(2400, 1600, 0x10) },
        { type: "VP8L", payload: vp8lPayload(2400, 1600, true) },
      ]),
    ],
    [
      "VP8X with optional ICCP, EXIF, and XMP chunks",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(2400, 1600, 0x3c) },
        { type: "ICCP", payload: [1] },
        { type: "ALPH", payload: [0] },
        { type: "VP8 ", payload: vp8Payload(2400, 1600) },
        { type: "EXIF", payload: [2] },
        { type: "XMP ", payload: [3] },
      ]),
    ],
  ])("accepts a static extended WebP %s", async (_kind, bytes) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(2400, 1600);
    const input = `data:image/webp;base64,${bytesToBase64(bytes)}`;

    await expect(sanitizePhotoForLocalAI(input)).resolves.toBe(
      "data:image/jpeg;base64,sanitized-photo",
    );
    expect(assignedSources).toEqual([input]);
  });

  it.each([
    ...[0x80, 0x40, 0x01].map((reservedBit) => [
      `reserved VP8X flag bit 0x${reservedBit.toString(16)}`,
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, reservedBit) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ]),
    [
      "declared ICCP without chunk",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x20) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
    [
      "declared alpha without ALPH",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x10) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
    [
      "declared EXIF without chunk",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x08) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
    [
      "declared XMP without chunk",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x04) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
    ...[
      ["ICCP", 0x20],
      ["ALPH", 0x10],
      ["EXIF", 0x08],
      ["XMP ", 0x04],
    ].map(([chunkType]) => [
      `present ${chunkType} without its VP8X flag`,
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1) },
        { type: chunkType as string, payload: [0] },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ]),
    ...["ICCP", "ALPH", "EXIF", "XMP "].map((chunkType) => [
      `duplicate ${chunkType} optional chunk`,
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, optionalChunkFlag(chunkType)) },
        { type: chunkType, payload: [0] },
        { type: chunkType, payload: [0] },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ]),
    [
      "ALPH before VP8L",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x10) },
        { type: "ALPH", payload: [0] },
        { type: "VP8L", payload: vp8lPayload(1, 1, true) },
      ]),
    ],
    [
      "VP8L alpha bit missing from VP8X flag",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1) },
        { type: "VP8L", payload: vp8lPayload(1, 1, true) },
      ]),
    ],
    [
      "VP8X alpha flag missing from VP8L alpha bit",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x10) },
        { type: "VP8L", payload: vp8lPayload(1, 1) },
      ]),
    ],
  ] as Array<[string, Uint8Array]>)("rejects static extended WebP flag mismatch %s before image assignment", async (_kind, bytes) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(1, 1);

    await expect(
      sanitizePhotoForLocalAI(`data:image/webp;base64,${bytesToBase64(bytes)}`),
    ).rejects.toThrow(/photo|dimension/i);
    expect(assignedSources).toEqual([]);
  });

  it.each([
    ["no image bitstream", webpExtendedRiff([{ type: "VP8X", payload: vp8xPayload(1, 1) }])],
    [
      "multiple image bitstreams",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
        { type: "VP8L", payload: vp8lPayload(1, 1) },
      ]),
    ],
    [
      "incompatible canvas and VP8 dimensions",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(2, 1) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
    [
      "animated VP8X flag",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1, 0x02) },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
    [
      "ANIM chunk",
      webpExtendedRiff([
        { type: "VP8X", payload: vp8xPayload(1, 1) },
        { type: "ANIM", payload: [0, 0, 0, 0, 0, 0] },
        { type: "VP8 ", payload: vp8Payload(1, 1) },
      ]),
    ],
  ])("rejects extended WebP with %s before image assignment", async (_kind, bytes) => {
    const { assignedSources } = installPhotoSanitizerDomDouble(1, 1);

    await expect(
      sanitizePhotoForLocalAI(`data:image/webp;base64,${bytesToBase64(bytes)}`),
    ).rejects.toThrow(/photo|dimension/i);
    expect(assignedSources).toEqual([]);
  });

  it.each([
    [0, 1600],
    [2400, 0],
    [Number.NaN, 1600],
  ])("rejects a decoded image with invalid dimensions %s by %s", async (width, height) => {
    installPhotoSanitizerDomDouble(width, height);

    await expect(
      sanitizePhotoForLocalAI(photoDataUrl("image/jpeg", 2400, 1600)),
    ).rejects.toThrow(/decode|dimension|photo/i);
  });

  function installPhotoSanitizerDomDouble(width: number, height: number) {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => "data:image/jpeg;base64,sanitized-photo"),
    } as unknown as HTMLCanvasElement;

    const assignedSources: string[] = [];

    class DecodedImage {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(value: string) {
        assignedSources.push(value);
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", DecodedImage);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName === "canvas") {
        return canvas;
      }
      return originalCreateElement(tagName, options);
    });

    return { canvas, drawImage, assignedSources };
  }

  function photoDataUrl(mimeType: "image/jpeg" | "image/png" | "image/webp", width: number, height: number) {
    const bytes =
      mimeType === "image/png"
        ? pngBytes(width, height)
        : mimeType === "image/jpeg"
          ? jpegBytes(width, height)
          : webpVp8xBytes(width, height);
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  }

  function pngBytes(width: number, height: number) {
    return new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13, 73, 72, 68, 82,
      ...uint32BigEndian(width),
      ...uint32BigEndian(height),
    ]);
  }

  function jpegBytes(width: number, height: number, sofMarker = 0xc0) {
    return new Uint8Array([
      0xff, 0xd8, 0xff, sofMarker, 0, 17, 8,
      ...uint16BigEndian(height),
      ...uint16BigEndian(width),
      3, 1, 17, 0, 2, 17, 0, 3, 17, 0,
    ]);
  }

  function webpVp8xBytes(width: number, height: number) {
    return webpExtendedRiff([
      { type: "VP8X", payload: vp8xPayload(width, height) },
      { type: "VP8 ", payload: vp8Payload(width, height) },
    ]);
  }

  function webpVp8Bytes(width: number, height: number) {
    return webpRiff("VP8 ", vp8Payload(width, height));
  }

  function vp8Payload(width: number, height: number) {
    return [
      0, 0, 0,
      0x9d, 0x01, 0x2a,
      ...uint16LittleEndian(width),
      ...uint16LittleEndian(height),
    ];
  }

  function webpVp8lBytes(width: number, height: number) {
    return webpRiff("VP8L", vp8lPayload(width, height));
  }

  function vp8lPayload(width: number, height: number, alphaUsed = false) {
    const dimensions =
      (width - 1) | ((height - 1) << 14) | (alphaUsed ? 1 << 28 : 0);
    return [
      0x2f,
      dimensions & 0xff,
      (dimensions >>> 8) & 0xff,
      (dimensions >>> 16) & 0xff,
      (dimensions >>> 24) & 0xff,
    ];
  }

  function vp8xPayload(width: number, height: number, flags = 0) {
    return [
      flags, 0, 0, 0,
      ...uint24LittleEndian(width - 1),
      ...uint24LittleEndian(height - 1),
    ];
  }

  function optionalChunkFlag(chunkType: string) {
    switch (chunkType) {
      case "ICCP":
        return 0x20;
      case "ALPH":
        return 0x10;
      case "EXIF":
        return 0x08;
      case "XMP ":
        return 0x04;
      default:
        throw new Error(`Unsupported optional chunk: ${chunkType}`);
    }
  }

  function webpRiff(chunkType: string, payload: number[]) {
    return webpExtendedRiff([{ type: chunkType, payload }]);
  }

  function webpExtendedRiff(chunks: Array<{ type: string; payload: number[] }>) {
    const chunkBytes = chunks.flatMap(({ type, payload }) => {
      const paddedPayload = payload.length % 2 === 0 ? payload : [...payload, 0];
      return [
        ...Array.from(type, (character) => character.charCodeAt(0)),
        ...uint32LittleEndian(payload.length),
        ...paddedPayload,
      ];
    });
    const bytes = new Uint8Array([
      82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80,
      ...chunkBytes,
    ]);
    setUint32LittleEndian(bytes, 4, bytes.length - 8);
    return bytes;
  }

  function uint16BigEndian(value: number) {
    return [(value >>> 8) & 0xff, value & 0xff];
  }

  function uint16LittleEndian(value: number) {
    return [value & 0xff, (value >>> 8) & 0xff];
  }

  function uint24LittleEndian(value: number) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff];
  }

  function uint32LittleEndian(value: number) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
  }

  function setUint32LittleEndian(bytes: Uint8Array, offset: number, value: number) {
    bytes.set(uint32LittleEndian(value), offset);
  }

  function uint32BigEndian(value: number) {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  }

  function bytesToBase64(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...bytes));
  }
});

describe("local AI settings persistence", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips exactly the approved LocalAISettings fields", async () => {
    const settings = {
      ...localAISettings("vision"),
      confirmedPrivateLANEndpoint: null,
      apiKey: "must-not-persist",
      token: "must-not-persist",
      auth: "must-not-persist",
      secret: "must-not-persist",
    } satisfies LocalAISettings & {
      apiKey: string;
      token: string;
      auth: string;
      secret: string;
    };

    await saveLocalAISettings(settings);

    expect(await loadLocalAISettings()).toEqual({
      enabled: true,
      vendor: "naver",
      endpoint: "http://127.0.0.1:8000",
      model: "local-korean-model",
      capability: "vision",
      confirmedPrivateLANEndpoint: null,
    });
    expect(localStorage.getItem(localStorage.key(0) ?? "")).not.toMatch(
      /apiKey|token|auth|secret/i,
    );
  });

  it("removes the persisted Local AI settings", async () => {
    await saveLocalAISettings(localAISettings());
    await clearLocalAISettings();

    await expect(loadLocalAISettings()).resolves.toBeNull();
  });

  it.each([
    ["http://user:password@127.0.0.1:8000", null],
    ["http://8.8.8.8:8000", null],
    ["http://127.0.0.1:8000?token=secret", null],
    ["http://127.0.0.1:8000#fragment", null],
    ["http://192.168.0.20:8000", null],
    ["http://192.168.0.20:8000", "http://192.168.0.21:8000"],
    ["http://192.168.0.20:8000", "http://192.168.0.20:8000"],
  ] as const)(
    "refuses unsafe settings endpoint %s without writing storage",
    async (endpoint, confirmedPrivateLANEndpoint) => {
      const setSetting = vi.spyOn(nativePreferences, "setSetting");

      await expect(
        saveLocalAISettings({
          ...localAISettings(),
          endpoint,
          confirmedPrivateLANEndpoint,
        }),
      ).rejects.toThrow(/invalid/i);
      expect(setSetting).not.toHaveBeenCalled();
      setSetting.mockRestore();
    },
  );

  it("stores loopback settings with no private-LAN confirmation", async () => {
    await saveLocalAISettings({
      ...localAISettings(),
      confirmedPrivateLANEndpoint: "http://192.168.0.20:8000",
    });

    await expect(loadLocalAISettings()).resolves.toEqual(localAISettings());
  });

  it("returns null for malformed or unsafe stored settings", async () => {
    await saveLocalAISettings(localAISettings());
    const key = localStorage.key(0);
    if (!key) {
      throw new Error("Local AI settings key was not persisted");
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        ...localAISettings(),
        endpoint: "http://8.8.8.8:8000",
      }),
    );

    await expect(loadLocalAISettings()).resolves.toBeNull();
  });

  it("purges a legacy confirmed HTTP private-LAN setting", async () => {
    await saveLocalAISettings(localAISettings());
    const key = localStorage.key(0);
    if (!key) {
      throw new Error("Local AI settings key was not persisted");
    }
    const legacyEndpoint = "http://192.168.0.20:8000";
    localStorage.setItem(
      key,
      JSON.stringify({
        ...localAISettings(),
        endpoint: legacyEndpoint,
        confirmedPrivateLANEndpoint: legacyEndpoint,
      }),
    );
    const removeSetting = vi.spyOn(nativePreferences, "removeSetting");

    await expect(loadLocalAISettings()).resolves.toBeNull();

    expect(removeSetting).toHaveBeenCalledWith(key);
    expect(localStorage.getItem(key)).toBeNull();
    removeSetting.mockRestore();
  });

  it.each([
    "{",
    JSON.stringify({ ...localAISettings(), endpoint: "http://user:password@127.0.0.1:8000" }),
    JSON.stringify({ ...localAISettings(), endpoint: "http://8.8.8.8:8000" }),
  ])("purges malformed or unsafe legacy web settings", async (legacyValue) => {
    await saveLocalAISettings(localAISettings());
    const key = localStorage.key(0);
    if (!key) {
      throw new Error("Local AI settings key was not persisted");
    }
    localStorage.setItem(key, legacyValue);
    const removeSetting = vi.spyOn(nativePreferences, "removeSetting");

    await expect(loadLocalAISettings()).resolves.toBeNull();

    expect(removeSetting).toHaveBeenCalledWith(key);
    expect(localStorage.getItem(key)).toBeNull();
    removeSetting.mockRestore();
  });

  it("does not remove an absent Local AI setting", async () => {
    const removeSetting = vi.spyOn(nativePreferences, "removeSetting");

    await expect(loadLocalAISettings()).resolves.toBeNull();

    expect(removeSetting).not.toHaveBeenCalled();
    removeSetting.mockRestore();
  });

  it("returns null when legacy-setting removal fails without exposing its value", async () => {
    await saveLocalAISettings(localAISettings());
    const key = localStorage.key(0);
    if (!key) {
      throw new Error("Local AI settings key was not persisted");
    }
    localStorage.setItem(key, "{");
    const removeSetting = vi
      .spyOn(nativePreferences, "removeSetting")
      .mockRejectedValueOnce(new Error("legacy cleanup failed"));

    await expect(loadLocalAISettings()).resolves.toBeNull();

    expect(removeSetting).toHaveBeenCalledWith(key);
    removeSetting.mockRestore();
  });
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
