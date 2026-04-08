import nextConfig from "../../next.config";

describe("next config", () => {
  it("enables static export for local-first hosting", () => {
    expect(nextConfig.output).toBe("export");
  });
});
