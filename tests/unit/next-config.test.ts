describe("next config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.MY_PASO_BUILD_TARGET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadConfig() {
    const configModule = await import("../../next.config");
    return configModule.default;
  }

  it("enables static export for local-first hosting", async () => {
    const nextConfig = await loadConfig();

    expect(nextConfig.output).toBe("export");
  });

  it("uses repository basePath for GitHub Pages builds", async () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REPOSITORY = "sinmb79/my-paso";

    const nextConfig = await loadConfig();

    expect(nextConfig.basePath).toBe("/my-paso");
    expect(nextConfig.assetPrefix).toBe("/my-paso");
    expect(nextConfig.env?.NEXT_PUBLIC_BASE_PATH).toBe("/my-paso");
  });

  it("forces an empty basePath for mobile builds", async () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REPOSITORY = "sinmb79/my-paso";
    process.env.MY_PASO_BUILD_TARGET = "mobile";

    const nextConfig = await loadConfig();

    expect(nextConfig.basePath).toBe("");
    expect(nextConfig.assetPrefix).toBe("");
    expect(nextConfig.env?.NEXT_PUBLIC_BASE_PATH).toBe("");
  });
});
