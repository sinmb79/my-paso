import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const expectedVersion = "0.3.0";
const expectedVersionCode = 6;

function readGradleDefault(source: string, name: "Code" | "Name"): string {
  const expression = new RegExp(
    name === "Code"
      ? "def appVersionCode = Integer\\.parseInt\\(System\\.getenv\\('MY_PASO_VERSION_CODE'\\) \\?: '([^']+)'\\)"
      : "def appVersionName = System\\.getenv\\('MY_PASO_VERSION_NAME'\\) \\?: '([^']+)'",
  );
  const match = source.match(expression);

  expect(match, `appVersion${name} must have a literal default`).not.toBeNull();
  return match![1];
}

function readPowerShellDefault(
  source: string,
  name: "Code" | "Name",
): string {
  const expression = new RegExp(
    name === "Code"
      ? "\\[int\\]\\$VersionCode\\s*=\\s*(\\d+)"
      : "\\[string\\]\\$VersionName\\s*=\\s*'([^']+)'",
  );
  const match = source.match(expression);

  expect(match, `PowerShell Version${name} must have a literal default`).not.toBeNull();
  return match![1];
}

describe("0.3.0 release version metadata", () => {
  it("keeps package, lockfile, Gradle, and release-script defaults aligned", () => {
    const packageJson = JSON.parse(read("package.json")) as { version: string };
    const lockfile = JSON.parse(read("package-lock.json")) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    const gradle = read("android/app/build.gradle");
    const releaseScript = read("scripts/build-android-release.ps1");

    expect(packageJson.version).toBe(expectedVersion);
    expect(lockfile.version).toBe(expectedVersion);
    expect(lockfile.packages[""]?.version).toBe(expectedVersion);
    expect(readGradleDefault(gradle, "Name")).toBe(expectedVersion);
    expect(Number(readGradleDefault(gradle, "Code"))).toBe(expectedVersionCode);
    expect(readPowerShellDefault(releaseScript, "Name")).toBe(expectedVersion);
    expect(Number(readPowerShellDefault(releaseScript, "Code"))).toBe(
      expectedVersionCode,
    );
  });
});
