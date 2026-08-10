import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("ESLint configuration", () => {
  it("excludes only nested isolated worktrees from the repository lint scope", () => {
    const config = readFileSync(join(root, "eslint.config.mjs"), "utf8");

    expect(config).toContain('".worktrees/**"');
  });
});
