# Hello! My Paso! 0.3.0 — Google Play Data Safety 제출 증거

기준일: 2026-08-11 KST
대상: `com.mypaso.app` Alpha `0.3.0-alpha1` / versionCode 6
제출 상태: `검토 중인 변경사항`, 빠른 검사 완료, Google 검토 중

이 문서는 법률 자문이나 정책 적합성 보증이 아닙니다. 2026-08-11에 실제 Play Console에 제출한 답변과 그 후 재검증할 경계를 기록합니다. 실제 운영 흐름이나 최신 Google Play 정책이 달라지면 답변을 다시 검토해야 합니다.

## 1. 제출된 Console 답변

| 데이터 유형 | 수집 | 공유 | 필수/선택 | 목적 | 제출 근거 |
|---|---|---|---|---|---|
| `Photos` | **Yes — 사설망 AI 모드** | **No** | 선택 사항 | 앱 기능 | 비전 모델을 선택하고 사용자가 명시적으로 보낼 때 EXIF 제거 임시 사진 복사본 전송 |
| `Other user-generated content` | **Yes — 사설망 AI 모드** | **No** | 선택 사항 | 앱 기능 | 사용자가 미리보기에서 확인한 장소 이름과 메모로 기록·분류·키워드 초안 생성 |

- 전송 중 암호화: **Yes**. 기기 밖 수집은 사용자 확인을 거친 HTTPS 사설망 연결에서만 가능하고 플랫폼 TLS를 사용합니다. HTTP는 localhost·loopback에만 허용되어 같은 기기 안에서 처리됩니다.
- 공유: **No**. 사용자가 자신이 관리하는 엔드포인트로 미리보기 뒤 직접 전송하는 제출 흐름입니다.
- 정확한 위치, 방문 좌표, EXIF·사진 메타데이터, 다른 기록, 백업 데이터와 API 키는 AI 요청에 포함하지 않습니다.
- AI 결과는 편집 가능한 초안이며, 자동 저장·동기화·공유하지 않습니다. 사용자가 적용한 뒤 일반 저장 동작을 완료해야 기록됩니다.

## 2. 제품 전송 경계와 공식 근거

- AI는 선택 사항이고 모델 가중치는 앱에 포함되지 않습니다. 소유자가 OpenAI 호환 한국어 모델 실행기를 별도로 준비합니다.
- 앱은 이 기기의 HTTP/HTTPS `localhost`·loopback 또는 사용자가 정확한 주소를 다시 확인한 HTTPS 사설망 IPv4 엔드포인트만 허용합니다.
- HTTP 사설망, 공개 인터넷, 클라우드 및 개발자 운영 AI 엔드포인트는 차단하고 HTTPS 사설망만 확인 뒤 허용합니다. API 키나 인증 정보를 저장하거나 전송하지 않습니다.
- 요청 전 전송 미리보기를 표시하고, 사용자가 **이 내용으로 AI 초안 만들기**를 눌러 명시적으로 확인해야 전송합니다.
- 비전 모델은 새 캔버스에서 EXIF와 사진 메타데이터를 제거하고 축소한 임시 JPEG 복사본만 추가합니다.
- HTTPS 사설망 전송은 기기 밖 수집입니다. HTTP localhost는 기기 안에서 처리되므로 기기 밖 수집이 아닙니다. 22B Labs는 AI 엔드포인트를 운영하지 않고 요청을 수신, 보관 또는 열람하지 않습니다.

공식 근거:

- [Google Play Data safety 양식 안내](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play 사용자 데이터 정책](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play 명확한 공개와 동의 권장사항](https://support.google.com/googleplay/android-developer/answer/11150561)

## 3. 제출 범위와 Play 결과

- Alpha `0.3.0-alpha1`, versionCode 6 / versionName 0.3.0, min API 24 / target SDK 36을 제출했습니다.
- Alpha, 국문·영문 등록정보, 휴대전화·7인치·10인치 스크린샷, 개인정보처리방침 URL과 Data safety를 포함한 13개 변경사항을 전송했습니다.
- 개인정보처리방침 URL: `https://sinmb79.github.io/my-paso/privacy.html`.
- 새 휴대전화 4장과 수정된 태블릿 화면에는 AI-generated/modified 라벨을 지정했습니다. 기존 아이콘·feature graphic·이전 스크린샷에는 라벨을 지정하지 않았습니다.
- 새 설치 7.44 MB, 업데이트 5.98 MB, 지원 기기 변화 0으로 표시됐습니다.
- R8/Proguard mapping 부재와 native debug symbols 부재 경고 2건은 비차단입니다.

## 4. 제출 후 재검증 체크리스트

다음은 미완료된 Console 제출 항목이 아니라, 다음 릴리스 또는 엔드포인트 경계 변경 전에 수행할 사후 검증입니다. 개인 자료 대신 더미 사진·더미 메모와 더미 전용 AI 엔드포인트만 사용합니다.

- [ ] 실제 엔드포인트 소유·운영자가 사용자 본인인지, 프록시·DNS·원격 분석 SDK·클라우드 릴레이가 없는지 비밀 없는 증거로 재확인합니다. 다르면 공유 답변을 다시 판단합니다.
- [ ] AI 비활성 상태와 전송 미리보기 단계에서 수신 로그가 비어 있고, 명시적 전송 뒤 선택한 장소 이름·메모만 전송되는지 확인합니다.
- [ ] HTTP RFC1918 사설망 주소와 공개 IP·호스트 이름·자격 증명·경로·쿼리·프래그먼트 포함 주소가 차단되는지 확인합니다.
- [ ] 비전 요청 사진이 축소 JPEG이고 EXIF·위치·원본 메타데이터가 없는지 확인합니다.
- [ ] 오류·취소·타임아웃 뒤 현재 입력과 기존 기록이 유지되고, 초안 적용만으로 영구 저장·동기화·공유되지 않는지 확인합니다.
- [ ] HTTPS 사설망 E2E는 이번 더미 localhost 실행에서 주장하지 않았습니다. 시스템 신뢰 인증서 체인, 정확한 IP SAN 및 CORS 조건을 갖춘 경우에만 별도 검증합니다.
- [ ] Google 검토 승인과 Alpha 자동 게시 상태를 기록하고, 정책·운영 경계가 바뀌면 Console 답변과 공개 문구를 즉시 갱신합니다.
