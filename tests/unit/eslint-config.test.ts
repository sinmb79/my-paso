import eslintConfig from "../../eslint.config.mjs";

type GlobalIgnoreConfig = {
  ignores: string[];
  name?: string;
};

const protectedProjectPaths = [
  "src/**",
  "tests/**",
  "scripts/**",
  "docs/**",
  "public/**",
];

function findNamedGlobalIgnoreConfig(): GlobalIgnoreConfig {
  const config = eslintConfig.find(
    (entry): entry is GlobalIgnoreConfig =>
      typeof entry.name === "string" &&
      entry.name.startsWith("globalIgnores ") &&
      Array.isArray(entry.ignores),
  );

  if (!config) {
    throw new Error("Expected a named globalIgnores config entry.");
  }

  return config;
}

describe("ESLint configuration", () => {
  it("uses the named global ignore for only nested isolated worktrees", () => {
    const globalIgnore = findNamedGlobalIgnoreConfig();

    expect(globalIgnore.ignores).toContain(".worktrees/**");
    expect(globalIgnore.ignores).not.toEqual(
      expect.arrayContaining([
        ".worktrees",
        ".worktrees*",
        "**/.worktrees/**",
        ...protectedProjectPaths,
      ]),
    );
  });
});
