import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const MAX_SMOKE_REQUEST_BYTES = 16 * 1024 * 1024;

const LOOPBACK_HOST = "127.0.0.1";
const CHAT_PATH = "/v1/chat/completions";

const DUMMY_DRAFT = Object.freeze({
  title: "더미 산책 기록",
  body: "Android 루프백 연결 확인을 위한 더미 초안입니다.",
  category: "nature",
  keywords: ["루프백", "연결 확인"],
  mood: "차분함",
  altText: "루프백 통신 확인용 더미 이미지 설명",
  observations: ["실제 사용자 기록을 저장하지 않습니다."],
});

const RESPONSE_BODY = JSON.stringify({
  id: "paso-loopback-smoke",
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify(DUMMY_DRAFT),
      },
      finish_reason: "stop",
    },
  ],
});

function sendJson(response, status, value) {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    Connection: "close",
  });
  response.end(body);
}

function requestMetadata(request, status, bytes) {
  const route = request.url === CHAT_PATH ? "chat" : "other";
  return `loopback-ai-smoke method=${request.method ?? "UNKNOWN"} route=${route} status=${status} bytes=${bytes}`;
}

function validChatRequest(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.model === "string" &&
    value.model.length > 0 &&
    Array.isArray(value.messages)
  );
}

export async function createLocalAISmokeServer(options = {}) {
  const port = options.port ?? 8000;
  const log = options.log ?? ((line) => console.log(line));
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("Smoke fixture port must be an integer from 0 through 65535.");
  }
  if (typeof log !== "function") {
    throw new Error("Smoke fixture logger must be a function.");
  }

  const server = createServer((request, response) => {
    if (request.url !== CHAT_PATH) {
      sendJson(response, 404, { error: "not_found" });
      log(requestMetadata(request, 404, 0));
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "method_not_allowed" });
      log(requestMetadata(request, 405, 0));
      return;
    }
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      sendJson(response, 415, { error: "json_required" });
      log(requestMetadata(request, 415, 0));
      return;
    }

    const declaredLength = request.headers["content-length"];
    if (declaredLength !== undefined) {
      const parsedLength = Number(declaredLength);
      if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
        sendJson(response, 400, { error: "invalid_content_length" });
        log(requestMetadata(request, 400, 0));
        return;
      }
      if (parsedLength > MAX_SMOKE_REQUEST_BYTES) {
        sendJson(response, 413, { error: "request_too_large" });
        log(requestMetadata(request, 413, parsedLength));
        request.destroy();
        return;
      }
    }

    let byteLength = 0;
    let finished = false;
    const chunks = [];
    request.on("data", (chunk) => {
      if (finished) {
        return;
      }
      byteLength += chunk.byteLength;
      if (byteLength > MAX_SMOKE_REQUEST_BYTES) {
        finished = true;
        chunks.length = 0;
        sendJson(response, 413, { error: "request_too_large" });
        log(requestMetadata(request, 413, byteLength));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (finished) {
        return;
      }
      finished = true;

      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks, byteLength).toString("utf8"));
      } catch {
        sendJson(response, 400, { error: "invalid_json" });
        log(requestMetadata(request, 400, byteLength));
        return;
      } finally {
        chunks.length = 0;
      }

      if (!validChatRequest(parsed)) {
        sendJson(response, 400, { error: "invalid_chat_request" });
        log(requestMetadata(request, 400, byteLength));
        return;
      }

      sendJson(response, 200, RESPONSE_BODY);
      log(requestMetadata(request, 200, byteLength));
    });
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, LOOPBACK_HOST);
  });

  const address = server.address();
  if (address === null || typeof address === "string" || address.address !== LOOPBACK_HOST) {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("Smoke fixture did not bind the required IPv4 loopback address.");
  }
  log(`loopback-ai-smoke event=listening host=${LOOPBACK_HOST} port=${address.port}`);

  let closed = false;
  return {
    host: LOOPBACK_HOST,
    port: address.port,
    origin: `http://${LOOPBACK_HOST}:${address.port}`,
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function parseCliPort(arguments_) {
  if (arguments_.length === 0) {
    return 8000;
  }
  if (arguments_.length !== 2 || arguments_[0] !== "--port") {
    throw new Error("Usage: node scripts/local-ai-smoke-server.mjs [--port 8000]");
  }
  return Number(arguments_[1]);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  try {
    const fixture = await createLocalAISmokeServer({ port: parseCliPort(process.argv.slice(2)) });
    const stop = async () => {
      await fixture.close();
      process.exit(0);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Smoke fixture failed.");
    process.exitCode = 1;
  }
}
