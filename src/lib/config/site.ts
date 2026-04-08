const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function getBasePath() {
  if (!rawBasePath || rawBasePath === "/") {
    return "";
  }

  return rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`;
}

export function withBasePath(path: string) {
  const basePath = getBasePath();

  if (!path.startsWith("/")) {
    return basePath ? `${basePath}/${path}` : `/${path}`;
  }

  return basePath ? `${basePath}${path}` : path;
}
