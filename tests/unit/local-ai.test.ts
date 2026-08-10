import { validateLocalAIEndpoint } from "@/lib/ai/endpoint-policy";
import { LOCAL_AI_MODEL_CATALOG } from "@/lib/ai/model-catalog";

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
