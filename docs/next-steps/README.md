# 다음 작업

최종 갱신일: **2026-11-01 (Asia/Seoul)**.

공부 계획은 [`docs/plans/`](../plans/README.md)에 있다. 2027년 시험 일정이 공고되면 잠정 날짜를 문서와 앱에서 고친다. 정보처리기사 실기는 2027년 3회가 기한이므로 접수 기간을 놓치지 않는다. 앱의 목표 등급은 다음에 노리는 등급이다.

## 우선 처리

우선순위 규칙(std-backlog 5장): 선행 조건이 끝난 이슈 중 우선순위 숫자가 작은 것, 같으면 번호가 작은 것부터 한다.

| 순서 | 할 일                       | 우선순위 | 상태             | 다음 행동                                                            |
| ---- | --------------------------- | -------- | ---------------- | -------------------------------------------------------------------- |
| 1    | #80 전체 테스트의 시간 초과 | P2       | 사용자 결정 대기 | 중앙 vitest 설정의 `testTimeout`을 올릴지 정한다. 진단은 이슈에 있다 |

## 함께 볼 것

- PR #15(`zod` 3 → 4)는 처리하지 않고 그대로 둔다. 2026-11-01 사용자가 project-standards#307의 zod 3 유지 결정을 바꿔, project-standards#386에서 앱 8개를 4.6.7로 올린다. 이 앱의 코드는 [#73](https://github.com/sirloinbh/cert-manager/issues/73)에서 `zod/v4` 문법으로 옮겼다. `backend/package.json`의 zod 버전은 중앙 관리 값이라 중앙 동기화 PR로 올라가고, `npm audit`의 zod high 1건과 Dependabot 알림은 그때 닫힌다. 그때까지 `backend/src`의 `z.array`는 스크립트 세 곳(#64 외부 API 응답과 번역 파일, #36 단어 파일)뿐이고 `.max()`가 붙어 있으며, 오류 메시지 개수는 중앙 `backend/src/standard/http.ts`가 제한한다. 새 배열 스키마에는 `.max()`를 붙인다.
- 요청 횟수 제한: `frontend/nginx.conf`의 `limit_req`와 그 뒤의 `backend/src/rate-limit.ts`(`express-rate-limit`) 두 겹이다(#49). 중앙 결정 project-standards#291은 nginx만 쓰는 것이고, 이 앱만 사용자 결정으로 다르다. CodeQL은 필수 검사가 아니다(필수: `ci / verify`, `ci / docker-build`).
- 이 PC에는 Docker가 없어 설치된 PostgreSQL 17(포트 5432)의 `cert`, `cert_test` DB를 쓴다. 새 마이그레이션은 두 DB에 모두 적용한다. 사용자 환경변수 `TEST_DATABASE_URL`은 study-log용이므로 바꾸지 말고, 다른 터미널에서는 그 세션에서만 `cert_test` 주소로 지정한다.
- 브라우저 확인은 임시 Postgres 컨테이너 + `node node_modules/tsx/dist/cli.mjs src/server.ts`(백엔드) + `npm run dev -w frontend`로 했다. `npx`는 프로젝트 훅이 막는다.
- `npm run knip`: 결과 없음(#30에서 `backend/src/standard/http.ts`를 쓰기 시작했다). CI는 `knip-strict`로 실패 단계를 쓴다.
- 이 PC의 Volta 기본 Node(24.22.1)가 프로젝트 고정 버전(24.21.0)과 달라 `npm install`·`npm ci`가 엔진 검사에서 막힌다. 설치할 때는 `volta run --node 24.21.0 --npm 11.19.0 npm ...`을 쓴다.

## 실행 경계

배포, 하위 저장소 동기화, AWS 리소스 생성은 별도 요청 시에만 한다. 공유 인프라의 ECR 저장소는 첫 배포 때 `shared-aws-infrastructure`의 목록에 추가한다.
