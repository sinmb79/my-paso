import { request as httpRequest } from "node:http";

import { validateLocalAIDraft } from "@/lib/ai/draft-validator";
import {
  createLocalAISmokeServer,
  MAX_SMOKE_REQUEST_BYTES,
} from "../../scripts/local-ai-smoke-server.mjs";

describe("local AI loopback smoke fixture", () => {
  it("binds only 127.0.0.1 and returns a deterministic validator-compatible draft", async () => {
    const logs: string[] = [];
    const fixture = await createLocalAISmokeServer({
      port: 0,
      log: (line: string) => logs.push(line),
    });

    try {
      expect(fixture.host).toBe("127.0.0.1");
      expect(fixture.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const requestBody = JSON.stringify({
        model: "dummy-model",
        messages: [{ role: "user", content: "DO-NOT-LOG-THIS" }],
      });
      const first = await fetch(`${fixture.origin}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        redirect: "error",
      });
      const second = await fetch(`${fixture.origin}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        redirect: "error",
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const firstBody = await first.text();
      const secondBody = await second.text();
      expect(secondBody).toBe(firstBody);
      const response = JSON.parse(firstBody) as {
        choices: Array<{ message: { content: string } }>;
      };
      expect(
        validateLocalAIDraft(JSON.parse(response.choices[0].message.content)),
      ).not.toBeNull();

      expect(logs.some((line) => line.includes("method=POST"))).toBe(true);
      expect(logs.some((line) => line.includes("status=200"))).toBe(true);
      expect(logs.join("\n")).not.toContain("DO-NOT-LOG-THIS");
      expect(logs.join("\n")).not.toContain("dummy-model");
    } finally {
      await fixture.close();
    }
  });

  it("rejects alternate methods, paths, and oversized declared bodies", async () => {
    const fixture = await createLocalAISmokeServer({ port: 0, log: () => undefined });

    try {
      const getResponse = await fetch(`${fixture.origin}/v1/chat/completions`);
      const pathResponse = await fetch(`${fixture.origin}/v1/models`, {
        method: "POST",
        body: "{}",
      });
      const oversizedStatus = await new Promise<number>((resolve, reject) => {
        const request = httpRequest(
          {
            host: fixture.host,
            port: fixture.port,
            path: "/v1/chat/completions",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": String(MAX_SMOKE_REQUEST_BYTES + 1),
            },
          },
          (response) => {
            response.resume();
            response.on("end", () => resolve(response.statusCode ?? 0));
          },
        );
        request.on("error", reject);
        request.end();
      });

      expect(getResponse.status).toBe(405);
      expect(pathResponse.status).toBe(404);
      expect(oversizedStatus).toBe(413);
    } finally {
      await fixture.close();
    }
  });
});
