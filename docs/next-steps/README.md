# 다음 작업

최종 갱신일: **2026-11-02 (Asia/Seoul)**.

공부 계획은 [`docs/plans/`](../plans/README.md)에 있다. 2027년 시험 일정이 공고되면 잠정 날짜를 문서와 앱에서 고친다. 정보처리기사 실기는 2027년 3회가 기한이므로 접수 기간을 놓치지 않는다. 앱의 목표 등급은 다음에 노리는 등급이다.

## 우선 처리

우선순위 규칙(std-backlog 5장): 선행 조건이 끝난 이슈 중 우선순위 숫자가 작은 것, 같으면 번호가 작은 것부터 한다.

#80이 닫히면 열린 이슈가 없다. 새 요구 사항이 들어오면 이슈로 등록한다.

## 함께 볼 것

- zod는 4.6.7이다(PR #75). 이 앱의 코드는 [#73](https://github.com/sirloinbh/cert-manager/issues/73)에서 `zod/v4` 문법으로 옮겼다. `backend/package.json`의 zod 버전은 중앙 관리 값이다. 새 코드는 `zod/v4`의 `{ error }`를 쓰고, 새 배열 스키마에는 `.max()`를 붙인다.
- `npm audit`(2026-11-02): 전체 moderate 16건, high 이상 없음. `--omit=dev`는 0건이라 운영 의존성에는 없다. ESLint 계열 개발 도구와 `minimatch`이고 자동 수정이 없다. Dependabot 열린 알림은 `minimatch` 1건이다. `npm audit fix --force`는 쓰지 않는다.
- 요청 횟수 제한: `frontend/nginx.conf`의 `limit_req`와 그 뒤의 `backend/src/rate-limit.ts`(`express-rate-limit`) 두 겹이다(#49). 중앙 결정 project-standards#291은 nginx만 쓰는 것이고, 이 앱만 사용자 결정으로 다르다. CodeQL은 필수 검사가 아니다(필수: `ci / verify`, `ci / docker-build`).
- 이 PC에는 Docker가 없어 설치된 PostgreSQL 17(포트 5432)의 `cert`, `cert_test` DB를 쓴다. 새 마이그레이션은 두 DB에 모두 적용한다. 사용자 환경변수 `TEST_DATABASE_URL`은 study-log용이므로 바꾸지 말고, 다른 터미널에서는 그 세션에서만 `cert_test` 주소로 지정한다.
- 브라우저 확인은 임시 Postgres 컨테이너 + `node node_modules/tsx/dist/cli.mjs src/server.ts`(백엔드) + `npm run dev -w frontend`로 했다. `npx`는 프로젝트 훅이 막는다.
- `npm run knip`: 결과 없음(#30에서 `backend/src/standard/http.ts`를 쓰기 시작했다). CI는 `knip-strict`로 실패 단계를 쓴다.
- 이 PC의 Volta 기본 Node(24.22.1)가 프로젝트 고정 버전(24.21.0)과 달라 `npm install`·`npm ci`가 엔진 검사에서 막힌다. 설치할 때는 `volta run --node 24.21.0 --npm 11.19.0 npm ...`을 쓴다.

## 실행 경계

배포, 하위 저장소 동기화, AWS 리소스 생성은 별도 요청 시에만 한다. 공유 인프라의 ECR 저장소는 첫 배포 때 `shared-aws-infrastructure`의 목록에 추가한다.
