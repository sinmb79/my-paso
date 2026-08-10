# Release Task 6 implementer report

Base: `4026352` (`docs: gate Android loopback AI transport`)

## Result

- Added a purpose-built Capacitor Android plugin for the single fixed JSON
  `POST /v1/chat/completions` operation.
- Kept app-wide cleartext denied. The Android Network Security Configuration
  grants cleartext only to exact `localhost`, `127.0.0.1`, and `::1` domain
  entries with subdomains disabled.
- Kept WebView mixed content, global `usesCleartextTraffic`, and the global
  Capacitor HTTP fetch/XHR patch disabled.
- Routed only Android HTTP loopback without an explicitly injected `fetch`
  through the plugin. HTTPS loopback/private-LAN, web, iOS, and injected test
  fetches retain the existing bounded Fetch/TLS path.
- Added a 127.0.0.1-only, deterministic, non-persistent dummy smoke fixture.

The Android declarations follow the official Network Security Configuration
and `NetworkSecurityPolicy` contracts. The relevant Capacitor 8.4.2 source was
read locally before implementation: `registerPlugin`, `BridgeActivity`,
`Plugin`, `PluginCall`, `JSObject`, `@CapacitorPlugin`, and the built-in HTTP
plugin lifecycle.

## TDD and debugging evidence

- Static RED: the native-config suite failed two assertions because the
  Network Security Config and plugin registration did not exist. It is now
  12/12 GREEN.
- JS RED: the expected native wrapper module did not exist. Selection,
  request/response bounds, cancellation, unsafe-target, redirect, and assistant
  routing tests are now GREEN.
- Cancellation-race RED: a synchronous abort between native request creation
  and listener registration stalled instead of rejecting. The wrapper now
  rechecks the signal immediately after listener registration; the regression
  test passes.
- Java RED: the app did not have `LoopbackAIHttpPlugin`; later RED cycles also
  proved missing no-redirect configuration and missing proxy bypass. The final
  Java suite has 9 plugin tests with zero failures.
- Host-JVM investigation: Android's local unit-test `JSONObject` is an
  unimplemented stub (`Method opt ... not mocked`). The production
  `encodeRequestBody` still performs the bounded encode plus native
  `JSONObject`/non-empty `model`/`JSONArray messages` validation as one gate;
  byte-bound logic stays host-unit-tested and the actual Android JSON parser
  cases are in the compiled instrumentation suite.
- Fixture RED: the loopback smoke module did not exist. Two behavior tests now
  prove exact 127.0.0.1 binding, deterministic validator-compatible output,
  method/path/size rejection, and payload-free logs.
- Connected-test RED: both new loopback policy/JSON tests passed on the API 36
  emulator, while the existing Capacitor template test still expected the
  obsolete `com.getcapacitor.app` package. The assertion now matches the
  configured debug application ID, `com.mypaso.app.debug`; the complete
  connected suite is 3/3 GREEN.

## Native security boundary

- Canonical, case-sensitive HTTP authorities only: `localhost`, `127.0.0.1`,
  `[::1]`; missing/default port or canonical ports 1-65535 only.
- Rejects HTTPS in this bridge, private/public/alternate IPs, hostname aliases,
  decimal IPv4, alternate IPv6 spellings, user info, query, fragment, alternate
  path, zero/out-of-range/non-canonical ports, duplicate/invalid request IDs,
  malformed JSON, arrays, missing/empty model, and missing messages array.
- Opens the already validated URL with `Proxy.NO_PROXY`; a system/device HTTP
  proxy cannot relocate an accepted loopback request.
- Fixed POST, `Content-Type` and `Accept: application/json`, redirects disabled,
  no caches, no user interaction, 45-second connect/read timeouts, and fixed
  request length.
- Request UTF-8 maximum: 16 MiB. Response maximum: 32 KiB before decoding or
  crossing the JS bridge. Declared and streamed response sizes are checked.
- A bounded executor limits concurrent/queued work. Each request ID maps to a
  cancellable state; cancellation disconnects the exact active connection.
- No authorization option, certificate override, trust-all code, request or
  response content logging, or content persistence was added.

## Verification observed

| Command / evidence | Result |
| --- | --- |
| Focused JS/static/fixture tests | 4 files / 170 tests passed |
| `npm test` | 32 files / 287 tests passed |
| `npx tsc --noEmit` | passed |
| `npm run lint` | passed |
| `npm run build` | passed, Next.js 16.3.0 static build |
| `npm run build:mobile` | passed, static mobile build |
| `npm run cap:sync:android` | passed, five Capacitor plugins synchronized |
| `npm audit --json` | 0 known vulnerabilities |
| `npm audit --omit=dev --json` | 0 known vulnerabilities |
| Gradle `:app:testDebugUnitTest` | 10 total tests, 0 failures (9 plugin + template) |
| Gradle `:app:assembleDebugAndroidTest` | passed; policy/JSON instrumentation APK compiled |
| Gradle `:app:connectedDebugAndroidTest` | passed on API 36 emulator; 3 tests, 0 failures |
| Gradle `:app:lintRelease` | passed; `No issues found.` |
| Release merged manifest | Network Security Config reference present; no global cleartext attribute |
| `git diff --check` | passed; line-ending notices only |

The repository path contains a non-ASCII em dash, which Android Gradle rejects
on Windows. Verification used a temporary ASCII `P:` `subst` mapping to the
same worktree; no Gradle safety override or repository path relaxation was
added. Capacitor sync touched two tracked Gradle files only at the working-tree
line-ending layer. Their filtered hashes exactly matched the index, so they are
not part of this change.

## Explicitly deferred

The signed APK loopback E2E remains in the immediately following
release-candidate installation task, as specified by the release plan. The
debug instrumentation policy and native JSON gates were executed on the API 36
emulator in this task. No signing property, key, or release artifact was read
or modified.
