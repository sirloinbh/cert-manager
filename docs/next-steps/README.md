# 다음 작업

최종 갱신일: **2026-11-02 (Asia/Seoul)**.

공부 계획은 [`docs/plans/`](../plans/README.md)에 있다. 2027년 시험 일정이 공고되면 잠정 날짜를 문서와 앱에서 고친다. 정보처리기사 실기는 2027년 3회가 기한이므로 접수 기간을 놓치지 않는다. 앱의 목표 등급은 다음에 노리는 등급이다.

## 우선 처리

우선순위 규칙(std-backlog 5장): 선행 조건이 끝난 이슈 중 우선순위 숫자가 작은 것, 같으면 번호가 작은 것부터 한다.

새 요구 사항이 들어오면 이슈로 등록한다. 2026-11-02에 열려 있는 일은 [#85](https://github.com/sirloinbh/cert-manager/issues/85)(PR #86)이다.

| 순서 | 할 일                         | 하는 사람   | 다음 행동                                                                                                                                                                     |
| ---- | ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | PR #86 마무리                 | 에이전트    | 다른 세션에서 시작한 작업이다. 상태를 확인하고 이어 간다. 이 PC의 체크아웃이 그 브랜치에 있을 수 있으니 `git status`로 먼저 본다                                              |
| 2    | 가사 첫 받기                  | 사용자      | `npm run lyrics:import -w backend`를 실행한다. 실제 LRCLIB에는 아직 요청한 적이 없어 응답이 맞는지는 첫 실행에서 드러난다([#64 기록](../changes/64-lyrics-scripts.md))        |
| 3    | 단어 내용 확인                | 사용자      | 뜻과 예문은 AI가 썼고 품질 승인은 앞 50단어로 받았다. 마지막 759단어의 어원 요소는 읽지 않았다. 앱에서 쓰다가 틀린 값을 찾으면 고친다([#70 기록](../changes/70-word-fill.md)) |
| 4    | 15초 측정 조건 정정           | 에이전트    | project-standards#390의 표는 15초 측정의 부하를 24개로 적었지만 실제로는 더 컸다. 정정 코멘트를 단다([#80 기록](../changes/80-test-timeout.md))                               |
| 5    | 다른 앱의 시간 제한 반영 확인 | 에이전트    | 중앙 템플릿의 `testTimeout` 15초가 다른 앱에 들어갔는지 확인한다. 동기화 PR 병합은 사용자가 한다                                                                              |
| 6    | `npm audit` moderate 16건     | 사용자 결정 | ESLint 계열 개발 도구와 `minimatch`이고 운영 의존성은 0건이다. 안전한 자동 수정이 없어 그대로 둘지, 중앙 설정의 버전을 바꿀지 정한다                                          |

## 함께 볼 것

- zod는 4.6.7이다(PR #75). 이 앱의 코드는 [#73](https://github.com/sirloinbh/cert-manager/issues/73)에서 `zod/v4` 문법으로 옮겼다. `backend/package.json`의 zod 버전은 중앙 관리 값이다. 새 코드는 `zod/v4`의 `{ error }`를 쓰고, 새 배열 스키마에는 `.max()`를 붙인다.
- `npm audit`(2026-11-02): 전체 moderate 16건, high 이상 없음. `--omit=dev`는 0건이라 운영 의존성에는 없다. ESLint 계열 개발 도구와 `minimatch`이고 안전한 자동 수정이 없다. Dependabot 열린 알림은 `minimatch` 1건이다. `npm audit fix --force`는 쓰지 않는다.
- 요청 횟수 제한: `frontend/nginx.conf`의 `limit_req`와 그 뒤의 `backend/src/rate-limit.ts`(`express-rate-limit`) 두 겹이다(#49). 중앙 결정 project-standards#291은 nginx만 쓰는 것이고, 이 앱만 사용자 결정으로 다르다. CodeQL은 필수 검사가 아니다(필수: `ci / verify`, `ci / docker-build`).
- 이 PC에는 Docker가 없어 설치된 PostgreSQL 17(포트 5432)의 `cert`, `cert_test` DB를 쓴다. 새 마이그레이션은 두 DB에 모두 적용한다. 사용자 환경변수 `TEST_DATABASE_URL`은 study-log용이므로 바꾸지 말고, 다른 터미널에서는 그 세션에서만 `cert_test` 주소로 지정한다.
- 브라우저 확인은 임시 Postgres 컨테이너 + `node node_modules/tsx/dist/cli.mjs src/server.ts`(백엔드) + `npm run dev -w frontend`로 했다. `npx`는 프로젝트 훅이 막는다.
- `npm run knip`: 결과 없음(#30에서 `backend/src/standard/http.ts`를 쓰기 시작했다). CI는 `knip-strict`로 실패 단계를 쓴다.
- 이 PC의 Volta 기본 Node(24.22.1)가 프로젝트 고정 버전(24.21.0)과 달라 `npm install`·`npm ci`가 엔진 검사에서 막힌다. 설치할 때는 `volta run --node 24.21.0 --npm 11.19.0 npm ...`을 쓴다.

## 실행 경계

배포, 하위 저장소 동기화, AWS 리소스 생성은 별도 요청 시에만 한다. 공유 인프라의 ECR 저장소는 첫 배포 때 `shared-aws-infrastructure`의 목록에 추가한다.
