# 영어 공부 프로젝트 지침

단어장 등 영어 공부를 기록하고 복습하는 개인 서비스. 사용자는 본인 한 명이며 로그인은 없다. 외부 공개 전에는 사설 접속 또는 인증을 먼저 설계한다.

## 구현 작업 절차

기능 추가·수정·리팩터링·설정·문서·스킬 변경 요청에는 [english-study-implementation](skills/english-study-implementation/SKILL.md)을 읽고 적용한다.

1. `sirloinbh/english-study`에 이슈를 등록한다. 사용자가 지정한 기존 이슈가 있으면 재사용한다.
2. 이슈 번호를 포함한 작업 브랜치를 만든다: `<type>/<issue-number>-<slug>`.
3. 구현·수정과 관련 테스트를 함께 작성하고, 각 커밋에 `docs/changes/<issue-number>-<slug>.md` 변경 기록을 포함한다.
4. 커밋 전과 PR 생성·갱신 전에 `npm run check`를 실행하고 결과를 docs와 PR에 기록한다.
5. **PR의 필수 CI 검사가 모두 통과하면 에이전트(주 에이전트·로컬 워커)가 `scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <검증한 head SHA>`로 merge commit 병합하고 연결된 이슈가 닫혔는지 확인한다.**
   - 순차·스택 PR은 순서대로 병합한다. 앞 PR 병합 후 다음 PR 브랜치에 `origin/main`을 병합해 충돌을 해결하고 관련 테스트를 다시 실행한 뒤 일반 푸시(force 금지)하고, CI 통과 후 병합한다.
   - 계속 금지: 실패·실행 중 검사 상태의 병합, `--admin`·브랜치 보호 우회, 자기 PR 승인으로 검토 대체, `main` 직접 푸시, force push.
   - 현재 `main` 병합은 자동 배포와 연결되어 있지 않다. 배포가 연결되면 병합 후 배포 결과를 확인한다.

질문 답변·추천·읽기 전용 조사는 이슈나 브랜치를 만들지 않는다. 요구사항에 정해지지 않은 규칙(집계 방식, 정책, 범위)은 추천안과 함께 사용자에게 확인하고 이슈 코멘트로 기록한다.

## 프로젝트 기준

- 기술: React 19 + Vite + TypeScript, Express 5 + pg + Zod, PostgreSQL 17, npm workspaces, Docker Compose, GitHub Actions. Node 24.21.0 / npm 11.19.0.
- 포트(127.0.0.1 바인딩): 웹 8096, 호스트 DB 55446, API 3016, Vite 5176. 사용자 요청 없이 바꾸지 않는다.
- 날짜는 `YYYY-MM-DD`, 서비스 시간대는 `Asia/Seoul`. 서버의 "오늘"은 `serviceDate()`로 계산한다.
- 입력 검증과 판정은 서버에서도 수행한다. 여러 행 변경은 트랜잭션으로 처리한다. 사용자에게 보이는 검증 오류는 한국어 메시지로 지정한다.
- 마이그레이션은 `database/migrations` 한 곳에서 관리하고 재실행해도 안전하게 쓴다. 기존 DB 적용은 [DB 문서](database/README.md)의 `psql -f` 방식을 쓴다.
- `.env`, 인증 토큰, 실제 백업, Terraform state는 커밋하거나 docs·PR·로그에 기록하지 않는다.
- 사용자 변경을 덮어쓰지 않는다. 필요한 파일만 명시해서 stage한다.
- **npm 패키지 설치·삭제는 사용자 재확인 후에만 하고 `--ignore-scripts`를 우선한다.** `npm run <script>`, `npm ls`, `npm view`는 허용된다.
- GitHub 원격 작업은 개인 계정 `sirloinbh`의 `scripts/gh-project.ps1` 래퍼로 한다. 기본 회사 계정 `gh`로 원격 변경을 하지 않는다.
- `frontend`, `backend`, `database`의 하위 저장소는 배포용 subtree 대상이다. 일상 PR 작업 중 하위 저장소나 `main`에 직접 푸시하지 않는다. `scripts/push-repositories.ps1`은 별도 동기화 요청 시에만 쓴다. AWS 인프라는 공유 저장소 `sirloinbh/shared-aws-infrastructure`에서 관리한다.

## 스킬과 문서

- 구현·수정 테스트: [english-study-testing](skills/english-study-testing/SKILL.md). 새 기능은 관련 테스트, 버그 수정은 회귀 테스트를 함께 작성한다.
- 작업 절차: [english-study-implementation](skills/english-study-implementation/SKILL.md).
- 개발 기반: [english-study-foundation](skills/english-study-foundation/SKILL.md)과 [개발 환경 설정 기준](docs/project-setup.md).
- 스킬 원본은 `skills/`이다. Claude Code용 복제본 `.claude/skills/`는 직접 수정하지 않고 `npm run skills:sync`로 갱신한다.
- 작업 기록: `docs/changes/`. 일일 총정리: `docs/daily/YYYY-MM-DD.md`(목록은 `docs/daily/README.md`). 최신 다음 작업: `docs/next-steps/README.md`.

## 검증 명령

- 전체: `npm run check` (포맷 → lint → 타입 → 테스트 → 스킬 동기화 검사 → 빌드).
- DB 통합 테스트: 스키마를 준비한 전용 테스트 DB의 `TEST_DATABASE_URL`을 설정하고 `npm test`. 환경변수가 없으면 통합 테스트는 건너뛰므로 DB 검증 완료로 보고하지 않는다.
- 화면 변경: 모바일 390×844와 PC 1440×900에서 실제 브라우저로 확인하고 결과를 기록한다.
- 문서·스킬만 변경: 포맷·링크 검사와 skill-creator `quick_validate.py`(Windows는 `PYTHONUTF8=1`).
