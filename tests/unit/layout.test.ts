import { metadata } from "@/app/layout";
import manifest from "@/app/manifest";

describe("paso metadata", () => {
  it("declares an installable app and manifest", () => {
    expect(metadata.applicationName).toContain("Paso");
    expect(metadata.manifest).toBe("/manifest.webmanifest");
  });

  it("returns a standalone pwa manifest", () => {
    const result = manifest();

    expect(result.name).toBe("Hello! My Paso!");
    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/");
  });
});
