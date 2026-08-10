import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const releaseFacingFiles = [
  "README.md",
  "README.en.md",
  "public/privacy.html",
  "docs/mobile/store-assets/store-listing.txt",
  "docs/mobile/closed-test/release-notes-ko.txt",
  "docs/mobile/closed-test/release-notes-en.txt",
  "docs/mobile/closed-test/test-missions.md",
  "docs/mobile/closed-test/tester-guide-ko.txt",
  "docs/mobile/store-publishing.md",
  "docs/mobile/google-play-closed-testing.md",
  "docs/mobile/data-safety-0.3.0.md",
];

describe("Paso 0.3.0 privacy copy", () => {
  it("keeps each Play release note within the 500-character locale limit", () => {
    for (const path of [
      "docs/mobile/closed-test/release-notes-ko.txt",
      "docs/mobile/closed-test/release-notes-en.txt",
    ]) {
      expect(read(path).trim().length, path).toBeLessThanOrEqual(500);
    }
  });

  it("explains the optional owner-controlled AI boundary in Korean and English", () => {
    const korean = `${read("README.md")}\n${read("public/privacy.html")}`;
    const english = `${read("README.en.md")}\n${read("public/privacy.html")}`;

    expect(korean).toMatch(/선택 사항|선택적/);
    expect(korean).toMatch(/localhost/);
    expect(korean).toMatch(/사설망/);
    expect(korean).toMatch(/HTTP 사설망.*차단/);
    expect(korean).toMatch(/HTTPS 사설망.*허용/);
    expect(korean).toMatch(/EXIF/);
    expect(korean).toMatch(/전송 미리보기/);
    expect(korean).toMatch(/명시적 확인|직접 확인/);
    expect(korean).toMatch(/초안/);
    expect(korean).toMatch(/개발자[\s\S]*(?:엔드포인트|운영하지)/);

    expect(english).toMatch(/optional/i);
    expect(english).toMatch(/localhost/i);
    expect(english).toMatch(/private[- ]LAN/i);
    expect(english).toMatch(/HTTP private[- ]LAN.*blocked/i);
    expect(english).toMatch(/HTTPS private[- ]LAN.*allowed/i);
    expect(english).toMatch(/EXIF/);
    expect(english).toMatch(/preview/i);
    expect(english).toMatch(/explicit(?:ly)? (?:confirmation|send|confirms?)/i);
    expect(english).toMatch(/draft/i);
    expect(english).toMatch(/developer does not operate/i);
  });

  it("removes obsolete absolute no-transfer declarations from release-facing copy", () => {
    for (const path of releaseFacingFiles) {
      const content = read(path);
      expect(content, path).not.toMatch(/개발자 또는 제3자 서버로 수집하는 사용자 데이터:\s*없음/);
      expect(content, path).not.toMatch(/개발자·제3자 서버로 수집 또는 공유 없음/);
      expect(content, path).not.toMatch(/위치·사진·방문 기록은 외부 서버로 전송하지 않고/);
      expect(content, path).not.toMatch(/does not collect or share personal or app-usage data/i);
      expect(content, path).not.toMatch(/현재 HTTP 사설망도 허용|HTTP LAN endpoints are currently allowed|HTTP LAN traffic may be unencrypted|HTTP 사설망[^\r\n]*암호화되지 않을 수/i);
    }
  });

  it("records conservative Play Data safety answers and the official policy references", () => {
    const worksheet = read("docs/mobile/data-safety-0.3.0.md");

    expect(worksheet).toMatch(/Photos/);
    expect(worksheet).toMatch(/Other user-generated content/);
    expect(worksheet).toMatch(/선택 사항|optional/i);
    expect(worksheet).toMatch(/앱 기능|app functionality/i);
    expect(worksheet).toMatch(/사설망[\s\S]*수집[\s\S]*Yes|수집[\s\S]*Yes[\s\S]*사설망/i);
    expect(worksheet).toMatch(/전송 중 암호화[\s\S]*Yes|encrypted in transit[\s\S]*Yes/i);
    expect(worksheet).toMatch(/localhost[\s\S]*HTTP[\s\S]*기기 안|HTTP[\s\S]*localhost[\s\S]*on-device/i);
    expect(worksheet).toMatch(/HTTP 사설망.*차단/);
    expect(worksheet).toMatch(/HTTPS 사설망.*허용/);
    expect(worksheet).toMatch(/EXIF/);
    expect(worksheet).toMatch(/정확한 위치/);
    expect(worksheet).toContain("https://support.google.com/googleplay/android-developer/answer/10787469");
    expect(worksheet).toContain("https://support.google.com/googleplay/android-developer/answer/10144311");
    expect(worksheet).toContain("https://support.google.com/googleplay/android-developer/answer/11150561");
  });

  it("gives testers dummy-data, endpoint-blocking, receiver-log, and failure-preservation missions", () => {
    const missions = read("docs/mobile/closed-test/test-missions.md");
    const guide = read("docs/mobile/closed-test/tester-guide-ko.txt");
    const testerCopy = `${missions}\n${guide}`;

    expect(testerCopy).toMatch(/더미 사진/);
    expect(testerCopy).toMatch(/더미 메모/);
    expect(testerCopy).toMatch(/수신.*로그/);
    expect(testerCopy).toMatch(/공개[\s\S]*엔드포인트[\s\S]*차단/);
    expect(testerCopy).toMatch(/HTTP 사설망[\s\S]*(?:거부|차단)/);
    expect(testerCopy).toMatch(/HTTPS 사설망[\s\S]*(?:확인|허용)/);
    expect(testerCopy).toMatch(/실패[\s\S]*(?:입력|기록|내용)[\s\S]*유지/);
  });

  it("pins the publication date, current policy URL, and Play release state", () => {
    const privacy = read("public/privacy.html");
    const worksheet = read("docs/mobile/data-safety-0.3.0.md");
    const publishing = read("docs/mobile/store-publishing.md");
    const playGuide = read("docs/mobile/google-play-closed-testing.md");

    expect(privacy).toContain("Effective and last updated: 2026-08-11");
    expect(worksheet).toContain("기준일: 2026-08-11");
    expect(publishing).toContain("기준일: 2026-08-11");
    expect(playGuide).toContain("기준일: 2026-08-11");

    expect(playGuide).not.toContain("answer/17105854");
    expect(playGuide).toContain("answer/17190352");
    expect(playGuide).toMatch(/개발자 프로그램 정책.*answer\/17190352/);

    for (const copy of [publishing, playGuide]) {
      expect(copy).toMatch(/현재 게시 버전[^\r\n]*0\.2\.0-alpha4/);
      expect(copy).toMatch(/검토 중[^\r\n]*0\.3\.0[^\r\n]*versionCode 6/);
      expect(copy).toContain("0.3.0-alpha1");
      expect(copy).toContain("검토 중인 변경사항");
    }
  });
});
