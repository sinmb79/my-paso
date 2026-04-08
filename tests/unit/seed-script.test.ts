import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("seed script", () => {
  const outputDir = join(process.cwd(), "tests", ".tmp");
  const outputFile = join(outputDir, "pois-generated.json");

  beforeEach(() => {
    mkdirSync(outputDir, { recursive: true });
    rmSync(outputFile, { force: true });
  });

  afterEach(() => {
    rmSync(outputFile, { force: true });
  });

  it("writes deterministic dummy pois for offline map-shell testing", () => {
    execFileSync(
      process.execPath,
      [
        "scripts/seed-pois.mjs",
        "--mode=dummy",
        "--count=12",
        `--output=${outputFile}`,
      ],
      {
        cwd: process.cwd(),
        stdio: "pipe",
      },
    );

    const pois = JSON.parse(readFileSync(outputFile, "utf8")) as Array<{
      id: string;
      source: string;
      region: string;
    }>;

    expect(pois).toHaveLength(12);
    expect(pois[0]).toMatchObject({
      id: "dummy-poi-1",
      source: "dummy",
      region: "Seoul",
    });
    expect(new Set(pois.map((poi) => poi.id)).size).toBe(12);
  });

  it("fetches live-style records from provided endpoints and normalizes them", async () => {
    const responses = {
      "/tour": {
        response: {
          body: {
            items: {
              item: [
                {
                  contentid: "9001",
                  title: "Bukchon Hanok Village",
                  mapy: "37.5826",
                  mapx: "126.9830",
                  addr1: "Seoul",
                  addr2: "Jongno",
                  contenttypeid: "12",
                  overview: "Heritage alleys in central Seoul",
                },
              ],
            },
          },
        },
      },
      "/heritage": [
        {
          ccbaKdcd: "11",
          ccbaAsno: "00010000",
          ccbaMnm1: "Sungnyemun",
          latitude: 37.559948,
          longitude: 126.975307,
          sido: "Seoul",
          sigungu: "Jung",
          description: "National heritage gate",
        },
      ],
    };

    const server = createServer((request, response) => {
      const payload =
        responses[request.url?.split("?")[0] as keyof typeof responses] ?? [];
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(payload));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server failed to expose a port.");
    }

    try {
      await execFileAsync(
        process.execPath,
        [
          "scripts/seed-pois.mjs",
          "--mode=live",
          "--count=10",
          `--tour-url=http://127.0.0.1:${address.port}/tour`,
          `--heritage-url=http://127.0.0.1:${address.port}/heritage`,
          `--output=${outputFile}`,
        ],
        {
          cwd: process.cwd(),
        },
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    const pois = JSON.parse(readFileSync(outputFile, "utf8")) as Array<{
      id: string;
      name: string;
      source: string;
      category: string;
    }>;

    expect(pois).toHaveLength(2);
    expect(pois[0]).toMatchObject({
      id: "tourapi-9001",
      name: "Bukchon Hanok Village",
      source: "tourapi",
    });
    expect(pois[1]).toMatchObject({
      source: "heritage",
      category: "tourist_attraction",
    });
  });
});
