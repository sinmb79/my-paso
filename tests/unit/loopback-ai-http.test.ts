import {
  postAndroidLoopbackAI,
  shouldUseAndroidLoopbackTransport,
  type LoopbackAIHttpNativePlugin,
} from "@/lib/native/loopback-ai-http";

describe("Android loopback AI transport policy", () => {
  it.each([
    ["android", "http://localhost:8000", false, true],
    ["android", "http://127.0.0.1:8000", false, true],
    ["android", "http://[::1]:8000", false, true],
    ["android", "https://127.0.0.1:8000", false, false],
    ["android", "http://192.168.0.20:8000", false, false],
    ["android", "http://127.0.0.1:8000", true, false],
    ["ios", "http://127.0.0.1:8000", false, false],
    ["web", "http://127.0.0.1:8000", false, false],
  ] as const)(
    "selects platform=%s endpoint=%s injected=%s as %s",
    (platform, endpointOrigin, hasInjectedFetch, expected) => {
      expect(
        shouldUseAndroidLoopbackTransport({
          platform,
          endpointOrigin,
          hasInjectedFetch,
        }),
      ).toBe(expected);
    },
  );

  it.each([
    "http://localhost.evil:8000",
    "http://127.0.0.2:8000",
    "http://2130706433:8000",
    "not a URL",
  ])("rejects a non-exact loopback origin %s", (endpointOrigin) => {
    expect(
      shouldUseAndroidLoopbackTransport({
        platform: "android",
        endpointOrigin,
        hasInjectedFetch: false,
      }),
    ).toBe(false);
  });
});

describe("Android loopback AI native wrapper", () => {
  it.each([
    "http://localhost.evil:8000/v1/chat/completions",
    "http://192.168.0.20:8000/v1/chat/completions",
    "http://127.0.0.1:8000/v1/models",
    "http://user@127.0.0.1:8000/v1/chat/completions",
    "http://127.0.0.1:8000/v1/chat/completions?token=x",
    "http://127.0.0.1:0/v1/chat/completions",
    "http://127.0.0.1:65536/v1/chat/completions",
  ])("rejects unsafe native target %s before invoking the plugin", async (url) => {
    const plugin: LoopbackAIHttpNativePlugin = {
      post: vi.fn(),
      cancel: vi.fn(),
    };

    await expect(postAndroidLoopbackAI({ url, body: "{}" }, plugin)).rejects.toThrow(
      /not allowed/i,
    );
    expect(plugin.post).not.toHaveBeenCalled();
  });

  it("rejects an oversized UTF-8 request before invoking the native bridge", async () => {
    const plugin: LoopbackAIHttpNativePlugin = {
      post: vi.fn(),
      cancel: vi.fn(),
    };

    await expect(
      postAndroidLoopbackAI(
        {
          url: "http://127.0.0.1:8000/v1/chat/completions",
          body: "x".repeat(16 * 1024 * 1024 + 1),
        },
        plugin,
      ),
    ).rejects.toThrow(/too large/i);

    expect(plugin.post).not.toHaveBeenCalled();
  });

  it("cancels the matching native request immediately when the caller aborts", async () => {
    const caller = new AbortController();
    const cancellation = new Error("caller cancelled");
    const plugin: LoopbackAIHttpNativePlugin = {
      post: vi.fn(
        () => new Promise<never>(() => undefined),
      ),
      cancel: vi.fn().mockResolvedValue({ cancelled: true }),
    };

    const pending = postAndroidLoopbackAI(
      {
        url: "http://127.0.0.1:8000/v1/chat/completions",
        body: "{}",
        signal: caller.signal,
      },
      plugin,
    );
    await vi.waitFor(() => expect(plugin.post).toHaveBeenCalledOnce());
    const requestId = vi.mocked(plugin.post).mock.calls[0][0].requestId;
    caller.abort(cancellation);

    await expect(pending).rejects.toBe(cancellation);
    await vi.waitFor(() =>
      expect(plugin.cancel).toHaveBeenCalledWith({ requestId }),
    );
  });

  it("does not miss an abort that races native request registration", async () => {
    const caller = new AbortController();
    const cancellation = new Error("raced cancellation");
    const plugin: LoopbackAIHttpNativePlugin = {
      post: vi.fn(() => {
        caller.abort(cancellation);
        return new Promise<never>(() => undefined);
      }),
      cancel: vi.fn().mockResolvedValue({ cancelled: true }),
    };

    const pending = postAndroidLoopbackAI(
      {
        url: "http://127.0.0.1:8000/v1/chat/completions",
        body: "{}",
        signal: caller.signal,
      },
      plugin,
    );
    const observed = Promise.race([
      pending,
      new Promise<string>((resolve) => setTimeout(() => resolve("stalled"), 20)),
    ]);

    await expect(observed).rejects.toBe(cancellation);
    expect(plugin.cancel).toHaveBeenCalledOnce();
  });

  it("rejects an oversized native response before returning it to the assistant", async () => {
    const plugin: LoopbackAIHttpNativePlugin = {
      post: vi.fn().mockResolvedValue({
        status: 200,
        body: "가".repeat(11_000),
      }),
      cancel: vi.fn(),
    };

    await expect(
      postAndroidLoopbackAI(
        {
          url: "http://127.0.0.1:8000/v1/chat/completions",
          body: "{}",
        },
        plugin,
      ),
    ).rejects.toThrow(/too large/i);
  });

  it("accepts only a bounded response with an HTTP status and string body", async () => {
    const plugin: LoopbackAIHttpNativePlugin = {
      post: vi.fn().mockResolvedValue({ status: 200, body: "{}" }),
      cancel: vi.fn(),
    };

    await expect(
      postAndroidLoopbackAI(
        {
          url: "http://localhost:8000/v1/chat/completions",
          body: "{}",
        },
        plugin,
      ),
    ).resolves.toEqual({ status: 200, body: "{}" });

    expect(plugin.post).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.stringMatching(/^paso-ai-[a-z0-9-]+$/),
        url: "http://localhost:8000/v1/chat/completions",
        body: "{}",
      }),
    );
  });
});
