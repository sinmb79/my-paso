import type { NextConfig } from "next";

const isMobileBuild = process.env.MY_PASO_BUILD_TARGET === "mobile";
const isGitHubPages =
  !isMobileBuild && process.env.GITHUB_ACTIONS === "true";
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "my-paso";
const basePath = isGitHubPages ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
