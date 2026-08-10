import type { LocalAIEndpointValidation } from "./contracts";

const privateIpv4Ranges = [
  (octets: number[]) => octets[0] === 10,
  (octets: number[]) => octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31,
  (octets: number[]) => octets[0] === 192 && octets[1] === 168,
];

function parseCanonicalIpv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) {
    return null;
  }

  const octets = match.slice(1).map(Number);
  return octets.every((octet, index) =>
    octet <= 255 && String(octet) === match[index + 1],
  )
    ? octets
    : null;
}

function rawHost(endpoint: string): string | null {
  const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(endpoint)?.[1];
  if (!authority || authority.includes("@")) {
    return null;
  }

  if (authority.startsWith("[")) {
    const closingBracket = authority.indexOf("]");
    return closingBracket === -1 ? null : authority.slice(0, closingBracket + 1);
  }

  return authority.split(":", 1)[0] ?? null;
}

/**
 * Validates only literal loopback or HTTPS, explicitly confirmed private-LAN origins.
 * Hostnames are never resolved, preventing DNS-based locality bypasses.
 */
export function validateLocalAIEndpoint(
  endpoint: string,
  confirmedPrivateLANEndpoint: string | null = null,
): LocalAIEndpointValidation {
  if (endpoint.trim() !== endpoint) {
    return { ok: false, reason: "invalid_url" };
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "unsupported_scheme" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials_not_allowed" };
  }
  if (endpoint.includes("?")) {
    return { ok: false, reason: "query_not_allowed" };
  }
  if (endpoint.includes("#")) {
    return { ok: false, reason: "fragment_not_allowed" };
  }
  if (parsed.pathname !== "/") {
    return { ok: false, reason: "endpoint_path_not_allowed" };
  }

  const host = rawHost(endpoint);
  if (host === null) {
    return { ok: false, reason: "hostname_not_allowed" };
  }

  if (
    (host.toLowerCase() === "localhost" && parsed.hostname === "localhost") ||
    (host === "127.0.0.1" && parsed.hostname === "127.0.0.1") ||
    (host === "[::1]" && parsed.hostname === "[::1]")
  ) {
    return { ok: true, scope: "loopback", origin: parsed.origin };
  }

  const octets = parseCanonicalIpv4(host);
  if (!octets) {
    return { ok: false, reason: "hostname_not_allowed" };
  }
  if (!privateIpv4Ranges.some((contains) => contains(octets))) {
    return { ok: false, reason: "public_address_not_allowed" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "private_lan_https_required" };
  }
  if (confirmedPrivateLANEndpoint !== endpoint) {
    return { ok: false, reason: "confirmation_required" };
  }

  return { ok: true, scope: "private_lan", origin: parsed.origin };
}
