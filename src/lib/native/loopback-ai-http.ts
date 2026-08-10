import { registerPlugin } from "@capacitor/core";

import type { AppPlatform } from "@/lib/native/platform";

const MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BODY_BYTES = 32 * 1024;
const FIXED_PATH = "/v1/chat/completions";
const SAFE_REQUEST_ID = /^paso-ai-[a-z0-9-]+$/;

type NativePostOptions = {
  requestId: string;
  url: string;
  body: string;
};

type NativeCancelOptions = {
  requestId: string;
};

export type LoopbackAIHttpNativeResponse = {
  status: number;
  body: string;
};

export type LoopbackAIHttpNativePlugin = {
  post(options: NativePostOptions): Promise<LoopbackAIHttpNativeResponse>;
  cancel(options: NativeCancelOptions): Promise<{ cancelled: boolean }>;
};

const LoopbackAIHttp = registerPlugin<LoopbackAIHttpNativePlugin>("LoopbackAIHttp");

let requestSequence = 0;

function nextRequestId(): string {
  requestSequence = (requestSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `paso-ai-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

function cancellationError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

function exactLoopbackAuthority(value: string): boolean {
  const match = /^(localhost|127\.0\.0\.1|\[::1\])(?::([1-9]\d{0,4}))?$/.exec(value);
  if (!match) {
    return false;
  }

  const port = match[2];
  return port === undefined || Number(port) <= 65_535;
}

function isExactLoopbackHttpOrigin(value: string): boolean {
  const match = /^http:\/\/([^/?#]+)$/.exec(value);
  return match !== null && exactLoopbackAuthority(match[1]);
}

function isFixedLoopbackChatUrl(value: string): boolean {
  const match = /^http:\/\/([^/?#]+)(\/[^?#]*)$/.exec(value);
  return (
    match !== null &&
    exactLoopbackAuthority(match[1]) &&
    match[2] === FIXED_PATH
  );
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validateNativeResponse(value: unknown): LoopbackAIHttpNativeResponse {
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isInteger((value as LoopbackAIHttpNativeResponse).status) ||
    (value as LoopbackAIHttpNativeResponse).status < 100 ||
    (value as LoopbackAIHttpNativeResponse).status > 599 ||
    typeof (value as LoopbackAIHttpNativeResponse).body !== "string"
  ) {
    throw new Error("Local AI native response was invalid.");
  }

  const response = value as LoopbackAIHttpNativeResponse;
  if (utf8Length(response.body) > MAX_RESPONSE_BODY_BYTES) {
    throw new Error("Local AI response body is too large.");
  }
  return response;
}

export function shouldUseAndroidLoopbackTransport(options: {
  platform: AppPlatform;
  endpointOrigin: string;
  hasInjectedFetch: boolean;
}): boolean {
  return (
    options.platform === "android" &&
    !options.hasInjectedFetch &&
    isExactLoopbackHttpOrigin(options.endpointOrigin)
  );
}

export async function postAndroidLoopbackAI(
  options: {
    url: string;
    body: string;
    signal?: AbortSignal;
  },
  nativePlugin: LoopbackAIHttpNativePlugin = LoopbackAIHttp,
): Promise<LoopbackAIHttpNativeResponse> {
  if (!isFixedLoopbackChatUrl(options.url)) {
    throw new Error("Local AI native target is not allowed.");
  }
  if (utf8Length(options.body) > MAX_REQUEST_BODY_BYTES) {
    throw new Error("Local AI request body is too large.");
  }
  if (options.signal?.aborted) {
    throw cancellationError(options.signal);
  }

  const requestId = nextRequestId();
  if (!SAFE_REQUEST_ID.test(requestId)) {
    throw new Error("Local AI request ID was invalid.");
  }

  const nativeRequest = nativePlugin.post({
    requestId,
    url: options.url,
    body: options.body,
  });

  if (!options.signal) {
    return validateNativeResponse(await nativeRequest);
  }

  let rejectForAbort: ((reason: unknown) => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectForAbort = reject;
  });
  const abort = () => {
    void nativePlugin.cancel({ requestId }).catch(() => {
      // Cancellation is best effort at the JS boundary; native owns disconnect enforcement.
    });
    rejectForAbort?.(cancellationError(options.signal as AbortSignal));
  };
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) {
    abort();
  }

  try {
    return validateNativeResponse(await Promise.race([nativeRequest, aborted]));
  } finally {
    options.signal.removeEventListener("abort", abort);
  }
}
