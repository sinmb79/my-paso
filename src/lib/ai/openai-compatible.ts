import { buildLocalAIRequest } from "./context-builder";
import type { LocalAIDraft, LocalAIRequestPreview, LocalAISettings } from "./contracts";
import { validateLocalAIDraft } from "./draft-validator";
import * as endpointPolicy from "./endpoint-policy";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ERROR_BODY_BYTES = 512;
const MAX_RESPONSE_BODY_BYTES = 32_768;
const MAX_DRAFT_JSON_LENGTH = 20_000;

type ChatMessage = {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cancellationError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

type BoundedBody = {
  text: string;
  tooLarge: boolean;
};

async function readBoundedBody(response: Response, maximumBytes: number): Promise<BoundedBody> {
  if (!response.body) {
    return { text: "", tooLarge: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const textParts: string[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return { text: textParts.join("") + decoder.decode(), tooLarge: false };
      }

      const remainingBytes = maximumBytes - byteLength;
      if (value.byteLength > remainingBytes) {
        if (remainingBytes > 0) {
          textParts.push(decoder.decode(value.subarray(0, remainingBytes), { stream: true }));
        }
        try {
          await reader.cancel();
        } catch {
          // A failed cancellation must not turn a bounded-body rejection into an unbounded fallback.
        }
        return { text: textParts.join("") + decoder.decode(), tooLarge: true };
      }

      byteLength += value.byteLength;
      textParts.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock?.();
  }
}

async function readBoundedError(response: Response): Promise<string> {
  try {
    const body = await readBoundedBody(response, MAX_ERROR_BODY_BYTES);
    return body.text.trim();
  } catch {
    return "";
  }
}

async function readBoundedJSON(response: Response): Promise<unknown> {
  const body = await readBoundedBody(response, MAX_RESPONSE_BODY_BYTES);
  if (body.tooLarge) {
    throw new Error("Local AI response body is too large.");
  }
  try {
    return JSON.parse(body.text);
  } catch {
    throw new Error("Local AI response did not contain valid JSON.");
  }
}

export function createOpenAICompatibleAssistant(options: {
  settings: LocalAISettings;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): {
  testConnection(signal?: AbortSignal): Promise<{ model: string }>;
  generate(preview: LocalAIRequestPreview, signal?: AbortSignal): Promise<LocalAIDraft>;
} {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function postChatCompletions(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (signal?.aborted) {
      throw cancellationError(signal);
    }

    const endpoint = endpointPolicy.validateLocalAIEndpoint(
      options.settings.endpoint,
      options.settings.confirmedPrivateLANEndpoint,
    );
    if (!endpoint.ok) {
      throw new Error(`Local AI endpoint is not allowed: ${endpoint.reason}`);
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(signal && cancellationError(signal));
    if (signal) {
      signal.addEventListener("abort", abortFromCaller, { once: true });
    }
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("Local AI request timed out.", "TimeoutError"));
    }, timeoutMs);

    try {
      const response = await fetchImpl(`${endpoint.origin}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: options.settings.model, messages }),
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await readBoundedError(response);
        throw new Error(
          `Local AI request failed (${response.status})${detail ? `: ${detail}` : ""}`,
        );
      }
      return await readBoundedJSON(response);
    } catch (error) {
      if (signal?.aborted) {
        throw cancellationError(signal);
      }
      if (timedOut) {
        throw new Error("Local AI request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  return {
    async testConnection(signal?: AbortSignal): Promise<{ model: string }> {
      await postChatCompletions(
        [
          {
            role: "user",
            content: "Return one JSON object confirming the selected model. Do not include journal content.",
          },
        ],
        signal,
      );
      return { model: options.settings.model };
    },

    async generate(
      preview: LocalAIRequestPreview,
      signal?: AbortSignal,
    ): Promise<LocalAIDraft> {
      const request = buildLocalAIRequest(preview);
      const userContent: ChatMessage["content"] =
        options.settings.capability === "vision" && request.imageDataUrl
          ? [
              { type: "text", text: JSON.stringify(request.input) },
              { type: "image_url", image_url: { url: request.imageDataUrl } },
            ]
          : JSON.stringify(request.input);
      const response = await postChatCompletions(
        [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: userContent },
        ],
        signal,
      );

      if (!isRecord(response) || !Array.isArray(response.choices) || response.choices.length === 0) {
        throw new Error("Local AI response did not include a draft choice.");
      }
      const firstChoice = response.choices[0];
      const content =
        isRecord(firstChoice) && isRecord(firstChoice.message)
          ? firstChoice.message.content
          : null;
      if (typeof content !== "string" || content.length > MAX_DRAFT_JSON_LENGTH) {
        throw new Error("Local AI response contained an invalid draft payload.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Local AI response did not contain valid JSON.");
      }
      const draft = validateLocalAIDraft(parsed);
      if (!draft) {
        throw new Error("Local AI response did not contain a valid draft object.");
      }
      return draft;
    },
  };
}
