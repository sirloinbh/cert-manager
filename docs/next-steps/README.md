# 다음 작업

최종 갱신일: **2026-10-30 (Asia/Seoul)**.

## 우선 처리

우선순위 규칙(std-backlog 5장): 선행 조건이 끝난 이슈 중 우선순위 숫자가 작은 것, 같으면 번호가 작은 것부터 한다.

| 순서 | 할 일                                     | 우선순위 | 상태      | 다음 행동                                                                                        |
| ---- | ----------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------ |
| 1    | #32 자격증 취득 기록과 만료일 관리        | P2       | 착수 가능 | `003_exam_attempts.sql`. 설계 5절. 마지막 유효일 계산 방식(더한 날 / 그 전날)은 공식 안내로 확인 |
| 2    | #33 자격증별 공부 계획 기능               | P2       | 착수 가능 | `004`. 순서 열은 지연 UNIQUE(설계 4절)                                                           |
| 3    | #34 목표 자격증 6개의 세부 공부 계획 작성 | P2       | 착수 가능 | 목표 점수·응시 시기를 사용자에게 먼저 확인                                                       |
| 4    | #35 팝송 가사 원문·번역 보기              | P2       | 착수 가능 | [자료 출처 조사](../research/english-content-sources.md)의 LRCLIB·세션 번역 절차를 따른다        |
| 5    | #36 영어 단어장과 어원 분석               | P2       | 착수 가능 | NGSL·Wiktionary(kaikki.org). `import_sources`는 #35·#36 중 먼저 하는 쪽에서                      |
| 6    | #37 오늘의 영어 단어                      | P3       | #36 다음  | 대시보드 카드                                                                                    |
| 7    | #22 모바일 빈 화면 안내 줄바꿈            | P4       | 착수 가능 | 호출부 `frontend/src/app.tsx`에서 `break-keep`                                                   |
| 8    | #38 자격증 후보 목록과 추천 로드맵 문서   | P4       | 착수 가능 | AWS 라인업 포함                                                                                  |

## 함께 볼 것

- PR #15(`zod` 3 → 4)는 처리하지 않고 그대로 둔다. 2026-10-28 사용자가 project-standards#307에서 후보 A를 골라 zod는 3.25.76에 머문다(project-standards `docs/research/zod4.md` 결정 절). `backend/package.json`의 zod 버전은 중앙 관리 값이다. 이 권고의 공격 경로는 길이 제한 없는 `z.array`이며, 지금 `backend/src`에는 `z.array`가 없고 오류 메시지 개수는 중앙 `backend/src/standard/http.ts`가 제한한다. 새 배열 스키마에는 `.max()`를 붙인다. `npm audit`의 zod high 1건과 Dependabot 알림은 이 결정 때문에 남아 있다.

- CodeQL `js/missing-rate-limiting`은 새 API 경로마다 다시 생긴다. 요청 횟수 제한은 nginx `limit_req`가 맡으므로(project-standards#291), 사용자 확인 뒤 "고치지 않음"으로 닫고 이유를 적는다. CodeQL은 필수 검사가 아니다(필수: `ci / verify`, `ci / docker-build`).
- 로컬 앱 DB는 `.env`가 없어 실행돼 있지 않다. 남은 사용자 할 일은 [2026-10-30 일일 기록](../daily/2026-10-30.md)에 있다.
- 브라우저 확인은 임시 Postgres 컨테이너 + `node node_modules/tsx/dist/cli.mjs src/server.ts`(백엔드) + `npm run dev -w frontend`로 했다. `npx`는 프로젝트 훅이 막는다.
- `npm run knip`: 결과 없음(#30에서 `backend/src/standard/http.ts`를 쓰기 시작했다). CI는 `knip-strict`로 실패 단계를 쓴다.
- 모바일 빈 화면 안내 문구가 단어 중간에서 줄바꿈된다. 호출부 `frontend/src/app.tsx`에서 고치는 [#22](https://github.com/sirloinbh/cert-manager/issues/22)로 분리했다.
- 이 PC의 Volta 기본 Node(24.22.1)가 프로젝트 고정 버전(24.21.0)과 달라 `npm install`·`npm ci`가 엔진 검사에서 막힌다. 설치할 때는 `volta run --node 24.21.0 --npm 11.19.0 npm ...`을 쓴다.

## 실행 경계

배포, 하위 저장소 동기화, AWS 리소스 생성은 별도 요청 시에만 한다. 공유 인프라의 ECR 저장소는 첫 배포 때 `shared-aws-infrastructure`의 목록에 추가한다.
