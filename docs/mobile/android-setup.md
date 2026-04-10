# Android Setup

윈도우에서 `Hello! My Paso!` Android 앱을 다시 빌드하고 에뮬레이터에서 확인하기 위한 실행 문서다. 목표는 환경 준비부터 APK 설치, 기본 smoke test까지 한 번에 재현하는 것이다.  
This document explains how to rebuild the `Hello! My Paso!` Android app on Windows and verify it in an emulator. The goal is to reproduce the full flow from environment setup to APK installation and a basic smoke test.

## Required Tools

| 항목 | 기준 |
| --- | --- |
| Node.js | 22 이상 |
| npm | Node와 함께 설치 |
| Android Studio | 최신 안정 버전 |
| JDK | Android Studio JBR 17+ 또는 그 이상 |
| Android SDK | `platform-tools`, `emulator`, API 36 이상 system image |
| AVD | 최소 1개 폰, 가능하면 1개 태블릿 |

| Item | Requirement |
| --- | --- |
| Node.js | 22 or newer |
| npm | Installed with Node |
| Android Studio | A recent stable version |
| JDK | Android Studio JBR 17+ or newer |
| Android SDK | `platform-tools`, `emulator`, and an API 36+ system image |
| AVD | At least one phone profile, ideally one tablet profile too |

## Environment Variables

PowerShell 세션 기준:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:PATH"
```

PowerShell session example:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:PATH"
```

## Build Flow

```powershell
npm install
npm run test
npm run lint
npm run build:mobile
npx cap sync android
```

Gradle wrapper는 현재 저장소 경로의 특수 문자 때문에 직접 실행이 꼬일 수 있다. 윈도우에서는 ASCII 드라이브 문자로 우회하는 방식이 가장 안전하다.  
Because the repository path contains non-ASCII characters, the Gradle wrapper may fail when launched directly. On Windows, the safest workaround is to mount the repo to a temporary ASCII drive letter.

```powershell
$repo = 'C:\Users\sinmb\workspace\Hello! My Paso! — Local-First Addendum\my-paso'
subst P: "$repo"
Push-Location P:\android
.\gradlew.bat assembleDebug
Pop-Location
subst P: /d
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Emulator Flow

AVD 목록 확인:

```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
```

예시 부팅:

```powershell
Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList '-avd','Medium_Phone_API_36.1','-no-audio','-no-window','-gpu','swiftshader_indirect'
& "$env:ANDROID_HOME\platform-tools\adb.exe" wait-for-device
```

설치와 실행:

```powershell
subst P: 'C:\Users\sinmb\workspace\Hello! My Paso! — Local-First Addendum\my-paso'
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r 'P:\android\app\build\outputs\apk\debug\app-debug.apk'
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n com.mypaso.app/.MainActivity
subst P: /d
```

## Smoke Test Checklist

1. 앱이 실행되고 `MainActivity`가 표시된다.
2. WebView가 열리고 홈/맵/저널 셸이 보인다.
3. 앱을 강제 종료 후 다시 열어도 IndexedDB 저장소가 유지된다.
4. 위치와 카메라 권한이 정상적으로 요청된다.

1. The app launches and `MainActivity` is displayed.
2. The WebView opens and the home/map/journal shell loads.
3. After a force stop and relaunch, IndexedDB-backed storage still exists.
4. Location and camera permissions prompt correctly.

## Useful Commands

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
& "$env:ANDROID_HOME\platform-tools\adb.exe" logcat -d
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell run-as com.mypaso.app ls -R app_webview/Default/IndexedDB
& "$env:ANDROID_HOME\platform-tools\adb.exe" emu geo fix 126.9779 37.5663
```

## Troubleshooting

| 문제 | 대응 |
| --- | --- |
| `Unable to access jarfile ... gradle-wrapper.jar` | 저장소를 `subst P:` 같은 ASCII 경로로 우회 |
| `Could not find the android platform` | `npm install @capacitor/android` 후 `npx cap add android` |
| `lint`가 Android build 산출물을 읽음 | `eslint.config.mjs`에서 `android/**`, `ios/**`를 ignore |
| WebView 저장소가 비어 보임 | `run-as com.mypaso.app ls -R app_webview/Default/IndexedDB`로 IndexedDB 존재 여부 확인 |
| 지도 토큰 없음 | fallback UI 확인으로 대신 검증 |

| Problem | Fix |
| --- | --- |
| `Unable to access jarfile ... gradle-wrapper.jar` | Use `subst P:` or another ASCII mount path |
| `Could not find the android platform` | Run `npm install @capacitor/android` and then `npx cap add android` |
| `lint` scans generated Android assets | Ignore `android/**` and `ios/**` in `eslint.config.mjs` |
| WebView storage appears empty | Inspect `app_webview/Default/IndexedDB` with `run-as` |
| No map token | Verify through the fallback UI instead |
