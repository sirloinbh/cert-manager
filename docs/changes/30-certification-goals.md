# #30 자격증 목표 등록과 목록 화면 만들기

- 이슈: [#30](https://github.com/sirloinbh/cert-manager/issues/30)
- 브랜치: `feat/30-certification-goals`
- 설계: [서비스 범위와 데이터 구조](../design/scope-and-data-model.md) 3절(화면)·5절(`certifications`)

## 목적

따고 싶은 자격증을 목표로 등록하고, 목표 시험일과 상태를 한 화면에서 보게 한다. 만료일 관리(#32)와 공부 계획(#33)이 이 목표 데이터 위에 만들어진다.

## 변경 — 2026-10-30

- DB: `database/migrations/002_certifications.sql`로 `certifications` 테이블을 만들었다. 열·`CHECK`는 설계 5절 그대로다. 유효기간 개월 수는 종류가 `months`일 때만 값이 있도록 표 제약 `certifications_validity_months`로 묶었다. 개인 데이터라 시드는 넣지 않았다.
- API: `backend/src/routes/certifications.ts`
  - `GET /api/certifications`: `{ today, certifications }`. 분류(영어 → 개발 → 생활), 목표 시험일 가까운 순, 시험일 없음은 뒤로 정렬한다.
  - `GET /api/certifications/:id`, `POST`(201), `PUT /:id`(전체 교체), `DELETE /:id`(204). 없는 목표는 404 `자격증 목표를 찾을 수 없습니다`.
  - 응답마다 `daysUntilExam`(오늘부터 목표 시험일까지 날 수, 지났으면 음수)을 넣는다. "오늘"은 서버의 `serviceDate()`(`Asia/Seoul`)이고 날 수는 SQL `date - date`로 센다.
  - 입력은 Zod로 검사하고 오류 문구는 한국어다. 설계에 길이 제한이 없는 주관 기관·목표 설명은 API에서 200자로 막았다(DB 제약은 없음). 메모는 제한하지 않는다(본문 크기 한도 256kb).
  - Zod 오류 판정은 `message` 옵션과 `code: 'custom'`만 써서 zod 4 전환(PR #15)에서도 그대로 동작하게 했다.
- `backend/src/app.ts`가 중앙 관리 파일 `backend/src/standard/http.ts`의 `notFound`·`errorHandler`·`serviceDate`를 쓰도록 바꿨다. 앱 안에 따로 있던 오류 처리기와 `serviceDate`를 지웠다.
- 화면
  - 메뉴를 대시보드 · 자격증 · 팝송 가사 · 단어장 · 설정 5개로 바꿨다. 팝송 가사·단어장은 아직 빈 화면 안내다.
  - `/certifications`: 분류별로 묶고 개수를 보여 준다. 카드마다 상태, 주관 기관·목표, 목표 시험일과 "N일 남음 / 오늘 시험 / N일 지남 / 시험일 미정"을 보여 준다.
  - `/certifications/new`, `/certifications/:id/edit`: 등록·수정 폼. 유효기간 개월 수 칸은 "개월 수 입력"을 골랐을 때만 나온다. 빈 숫자·날짜 칸은 "정하지 않음"(`null`)으로 보낸다.
  - `/certifications/:id`: 상세와 수정·삭제. 삭제는 공통 확인 대화상자를 거치고, 딸린 응시 기록·공부 계획도 함께 지워진다고 적었다.
  - 대시보드 "가까운 시험" 카드: 상태가 계획·공부 중·접수이고 시험일이 오늘 이후인 목표를 가까운 순으로 3개까지 보여 준다.
  - 화면 주소는 `frontend/src/app.tsx`의 `pages` 한 곳에 두고, 자격증 화면에는 주소 함수(`CertificationPaths`)로 넘긴다.
  - API 호출과 표시 규칙은 `frontend/src/certification-data.ts`, 화면은 `frontend/src/certifications.tsx`에 나눴다.

## 테스트

| 파일                                                     | 검증한 동작                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/test/certifications.test.ts`                    | 목록에 오늘 날짜 전달·숫자 ID, 빠진 선택 칸의 기본값, 잘못된 입력 12가지가 한국어 400이고 DB에 닿지 않음, 없는 목표 404, 잘못된 ID 400, 전체 교체와 204 삭제 |
| `backend/test/db.integration.test.ts`                    | 실제 DB에서 등록 → 정렬(분류·날짜·없음은 뒤) → 남은 날 수(21, -5, null) → 전체 교체 → 삭제 후 404. 테이블 제약이 개월 수 불일치와 빈 이름을 막음             |
| `frontend/src/certification-data.test.ts`                | 남은 날 문구, 유효기간 문구, 분류 묶기 순서, 가까운 시험 고르기(지난 날짜·날짜 없음·합격 제외, 오늘 포함)                                                    |
| `frontend/src/certifications.test.tsx`                   | 목록 묶기·정렬·문구, 빈 목록 안내, 등록 → 상세 → 목록 반영, 서버 오류 표시, 수정, 삭제 확인·취소, 없는 목표 안내, 대시보드 카드                              |
| `frontend/src/app.test.tsx`                              | 메뉴 5개 순서, 팝송 가사·단어장 빈 화면. 기존 테스트는 `/api/health` 외 요청에 빈 목록을 돌려주도록 고쳤다                                                   |
| `backend/test/helpers.ts`, `backend/test/health.test.ts` | 테스트 도우미가 메서드·본문을 보내고 204를 읽게 했다. `serviceDate` 가져오는 곳을 `standard/http.ts`로 바꿨다                                                |

## 검증

- 마이그레이션: 빈 테스트 DB(Docker `postgres:17-alpine`)에 `database/migrations/*.sql`을 psql로 두 번 적용했다. 두 번째는 `already exists, skipping` 알림만 나오고 오류가 없었다.
- `TEST_DATABASE_URL=… npm run check` (Node 24.21.0 / npm 11.19.0): 통과. 포맷·lint·타입 통과. 백엔드 12개 통과(DB 통합 2개 포함, 건너뜀 0), 프런트엔드 66개 통과, 스킬 4개 통과, 빌드 성공.
- `npm run knip`: 결과 없음. `node .standards/check.mjs`: 통과.
- 브라우저(Playwright, 로컬 Vite + API + 임시 DB):
  - 첫 목표 6개를 등록했다. 토익·토익 스피킹·정보처리기사·AWS CP·AWS SAA는 API로, 운전면허는 모바일 등록 화면으로 넣었다. 시험일(토익 2026-12-13, AWS CP 2026-11-21)은 화면 확인용 예시 값이다.
  - 모바일 390×844: 등록 폼, 등록 뒤 상세, 목록(분류별 묶음·남은 날 수), 삭제 대화상자, 대시보드 카드.
  - PC 1440×900: 목록(2열), 대시보드 카드, 수정(운전면허 상태 → 공부 중, API로 저장 확인), 임시 목표 삭제(삭제 뒤 API 404, 목록 6개로 돌아옴).
  - 콘솔 오류·경고 없음.
  - 확인 중 고친 것: 화면 설명과 삭제 대화상자 문장이 단어 중간에서 줄바꿈돼 `break-keep`을 넣었다. 대화상자 컴포넌트는 중앙 관리 파일이라 넘기는 문장 쪽에서 감쌌다.
- 로컬 DB: 사용자 PC의 Compose DB는 `.env`가 없어 실행돼 있지 않다. 위 6개는 확인용 임시 DB에 넣었고, 실제로 쓸 DB에는 화면에서 다시 등록해야 한다.

## 1차 자동 리뷰 반영 — 2026-10-30

PR #41의 1차 리뷰(작성 맥락과 분리된 읽기 전용 에이전트)에서 높음 0, 중간 0, 낮음 4건이 나왔다. 모두 이 PR에서 고쳤다.

- 낮음: 본문이 JSON 배열이면 Zod가 영어 문구(`Expected object, received array`)를 냈다. 객체 스키마에 `요청 본문은 JSON 객체여야 합니다`를 넣었다. 문자열 하나만 보낸 본문은 `express.json()`이 먼저 `요청 본문의 JSON 형식이 올바르지 않습니다`로 막는다.
- 낮음: `0000-01-01`은 날짜 검사를 통과하지만 PostgreSQL이 0년을 거부해 500이 됐다. 목표 시험일 하한을 `1900-01-01`로 두었다.
- 낮음: 삭제가 404가 아닌 오류로 실패하면 대화상자는 열린 채인데, 오류 문구는 대화상자 뒤 페이지에 나와 보이지 않았다. 오류를 대화상자 위에 뜨는 토스트로 보여 준다.
- 낮음(테스트): 위 세 경우를 테스트에 넣었다. `backend/test/certifications.test.ts`에 배열 본문·문자열 본문·0년 날짜, `frontend/src/certifications.test.tsx`에 삭제 실패(대화상자 유지, 오류 표시, 주소 그대로). `daysUntilExam`은 SQL에서 계산해 가짜 DB 단위 테스트로는 검증할 수 없고, CI에서 실행되는 DB 통합 테스트가 확인한다.
- 검증: `TEST_DATABASE_URL=… npm run check` 통과. 백엔드 12개 통과(건너뜀 0), 프런트엔드 67개 통과, 스킬 4개 통과, 빌드 성공. `npm run knip` 결과 없음.

## 2차 자동 리뷰 — 2026-10-30

1차 반영 커밋과 PR 전체를 다시 봤다. 보완점 없음.

- 1차 지적 4건의 수정이 맞다고 확인했다. 배열 본문의 한국어 문구, 1900-01-01 하한, 삭제 실패 토스트, 테스트가 해당한다.
- 리뷰어가 가정으로 남긴 "토스트가 대화상자 위에 보인다"는 토큰 값으로 확인했다. `--z-toast`는 70, `--z-modal`은 50이다(`@sirloinbh/design-tokens`).
- 리뷰는 최대 2회라 여기서 끝낸다.

## CodeQL 알림 — 2026-10-30

- 첫 푸시에서 CodeQL이 `js/missing-rate-limiting`(요청 횟수 제한 없음) 5건을 냈다. 새 API 경로 5개가 모두 해당한다. CodeQL은 필수 검사가 아니다(필수: `ci / verify`, `ci / docker-build`).
- 중앙 결정 project-standards#291: 요청 횟수 제한은 앱 코드가 아니라 `frontend/nginx.conf`의 `limit_req`(IP마다 초당 10개, 한 번에 40개)로 한다. 이 리포에도 이미 들어 있다. CodeQL은 Express 코드 안의 제한만 인식해 이 알림은 닫히지 않으며, 앱 리포 알림을 닫는 일은 사용자 확인 뒤에 하기로 했다.
- 그래서 앱 코드에 제한을 넣지 않았고, 알림을 닫을지는 사용자에게 묻는다.

## 제한·후속

- 대시보드 카드의 긴 이름은 한 줄로 줄여 보여 준다(전체 이름은 목록·상세에 있음).
- 앱 이름(상단·탭 제목)과 상태 확인의 `service` 값은 아직 "영어 공부"·`english-study`다. 이름 바꾸기는 [#27](https://github.com/sirloinbh/cert-manager/issues/27)에서 한다.
- 응시 기록·만료일은 #32, 공부 계획은 #33에서 이 목표에 붙인다.
