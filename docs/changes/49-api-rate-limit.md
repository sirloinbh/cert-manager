# #49 API 요청 횟수 제한 넣기

- 이슈: [#49](https://github.com/sirloinbh/cert-manager/issues/49)
- 브랜치: `feat/49-api-rate-limit`

## 목적

PR #48이 CodeQL `js/missing-rate-limiting` 경고 9건으로 실패해 병합하지 못했다. 새 API 경로마다 같은 경고가 다시 생긴다. 사용자가 경고를 닫기만 하지 않고 고치기로 했고, 방법으로 `express-rate-limit` 도입을 골랐다(2026-10-31).

## 결정

| 항목             | 결정                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 중앙 결정과 차이 | project-standards#291은 nginx `limit_req`만 쓰기로 정했다. 이 앱만 앱 안의 제한을 더한다. nginx 설정은 그대로 둔다                                |
| 한도             | 분당 1,200회. nginx(초당 10회, burst 40)가 먼저 막으므로, 앱 안의 제한은 nginx를 거치지 않는 요청을 위한 두 번째 방어선이다                       |
| 세는 기준        | 요청이 온 주소. nginx 뒤에서는 모든 요청이 nginx 주소 하나로 세어지지만, 사용자가 한 명이고 한도가 넉넉해 문제없다. 기록은 프로세스 메모리에 둔다 |
| 건강 확인 경로   | `/api/health`도 DB를 부르므로 제외하지 않는다                                                                                                     |

## 도입 검토

`docs/dependency-policy.md`(project-standards) 절차로 2026-10-31에 조회했다. 사용자 승인도 같은 날 받았다.

| 패키지                     | 출시일     | 라이선스 | 설치 스크립트                                    | 비고                                              |
| -------------------------- | ---------- | -------- | ------------------------------------------------ | ------------------------------------------------- |
| `express-rate-limit@8.7.1` | 2026-10-06 | MIT      | `prepare`만(레지스트리 설치에서는 실행되지 않음) | 최신 8.7.2는 2026-10-29 출시로 14일이 지나지 않음 |
| `ip-address@10.7.4`        | 2026-10-11 | MIT      | `prepare`만(레지스트리 설치에서는 실행되지 않음) | 새 전이 의존성. `debug@4.4.3`은 이미 있었음       |

처음 설치하면 `^10.2.0` 범위 때문에 2026-10-25 출시 `ip-address@10.7.5`가 들어와 14일 조건에 걸렸다. 검토 때 실제 설치될 버전을 확인하지 않아 생긴 일이다. 10.7.5 코드는 실행하기 전에 잠금 파일을 10.7.4로 고치고 `npm ci --ignore-scripts`로 다시 설치했다. `package.json`의 범위는 건드리지 않았으므로 `npm update`를 하면 다시 올라갈 수 있다.

## 변경 — 2026-10-31

- `backend/src/rate-limit.ts`: 제한 미들웨어. 초과하면 429와 `{ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' }`로 답한다.
- `backend/src/app.ts`: 본문 파싱과 모든 경로 앞에 넣었다. 테스트가 한도를 줄일 수 있도록 `createApp`이 `rateLimit` 옵션을 받는다.
- `backend/test/helpers.ts`: `withApi`가 `createApp`의 옵션을 그대로 받는다.
- `backend/package.json`, `package-lock.json`, `backend/package-lock.json`: 패키지 추가. 설치는 사용자가 직접 실행했고, 하위 잠금 파일은 `npm run lockfiles:sync`로 맞췄다.

## 테스트

`backend/test/rate-limit.test.ts`

- 한도를 넘으면 한국어 메시지와 429로 답하고 DB에 닿지 않는다.
- 기능 경로와 쓰기 요청도 함께 센다.
- 시간 창이 지나면 다시 허용한다.
- 기본 한도에서는 요청 50회가 모두 통과한다.

## 검증

- `TEST_DATABASE_URL=… npm run check`: 통과(exit 0). 포맷·lint·타입 통과, 백엔드 24개 통과(새 테스트 4개, 건너뜀 0), 프런트엔드 110개 통과, 스킬 4개 통과, 빌드 성공.
- 설치 버전 확인: `express-rate-limit` 8.7.1, `ip-address` 10.7.4.
- `node .standards/ioc-scan.mjs`: 의심 항목 없음. `node .standards/secret-scan.mjs`: 의심 항목 없음. `node .standards/check.mjs`: 통과. `npm run knip`: 결과 없음.
- Docker 이미지 빌드: 이 PC에 Docker가 없어 실행하지 못했다. CI `ci / docker-build`로 확인한다.
- 화면 변경이 없어 브라우저 확인은 하지 않았다.
