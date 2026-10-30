# #27 리포 안의 영어 공부 이름을 새 이름으로 바꾸기

- 이슈: [#27](https://github.com/sirloinbh/cert-manager/issues/27)
- 결정: [#25](https://github.com/sirloinbh/cert-manager/issues/25)(이름 `cert-manager`, 표시 이름 "자격증 관리", 고유 스킬 `cert-manager-*`)
- 선행: [#26](https://github.com/sirloinbh/cert-manager/issues/26), [sirloinbh/project-standards#347](https://github.com/sirloinbh/project-standards/issues/347)

## 목적

리포 이름은 #26에서 바뀌었지만 이 리포가 직접 관리하는 코드·스킬·문서에는 옛 이름 `english-study`와 "영어 공부"가 남아 있었다. 서비스 이름을 새 이름으로 맞춘다. 자격증과 별개 영역인 "영어 공부"(가사·단어장)와 자격증 분류 값 `english`는 이름이 아니라 기능이라서 그대로 둔다.

## 변경 — 2026-10-30

- 패키지 이름: 루트 `english-study` → `cert-manager`, 워크스페이스 `@english-study/{frontend,backend}` → `@cert-manager/{frontend,backend}`.
- lockfile: 루트 `package-lock.json`의 이름과 워크스페이스 링크(`node_modules/@cert-manager/*`)를 손으로 바꿨다. npm이 쓰는 이름순 자리(`@cacheable` 다음, `@csstools` 앞)로 옮겼다. 버전·해시는 바뀌지 않았다. `frontend/`, `backend/`의 lockfile은 이름 줄만 바꿨다. 패키지를 새로 설치하지 않았다.
- 화면: 상단 제목(`AppShell`의 `appName`)과 브라우저 탭 제목(`frontend/index.html`)을 "자격증 관리"로 바꿨다. 대시보드 설명의 "영어 공부"는 영역 이름이라 그대로 뒀다.
- `/api/health`의 `service` 값을 `cert-manager`로 바꿨다.
- 고유 스킬 3개를 `skills/cert-manager-{implementation,testing,foundation}`으로 옮기고 이름·설명·본문의 저장소 이름을 바꾼 뒤 `npm run skills:sync`로 `.claude/skills/`를 다시 만들었다.
- 문서: `AGENTS.project.md`, `README.md`(제목·서비스 설명·볼륨·하위 리포 이름), `frontend/README.md`, `backend/README.md`, `database/README.md`(제목, 마이그레이션 예시의 `psql -U cert -d cert`), `docs/next-steps/README.md`(#22 링크, #27 행 삭제, PR #15의 실패 원인 `Missing: zod@4.6.6 from lock file` 기록).
- `compose.yaml`: Docker 볼륨 이름 `english-study-data` → `cert-manager-data`. #26 기록은 기존 로컬 데이터가 갈라질 수 있어 보류했다. 이번에 `docker volume ls`로 확인해 보니 `english-study`·`cert-manager` 볼륨이 하나도 없어 지금 바꿔도 잃는 데이터가 없다.
- 하위 리포 CI의 이미지 이름: `frontend/.github/workflows/ci.yml`, `backend/.github/workflows/ci.yml`를 `cert-manager-{frontend,backend}`로 바꿨다.
- 테스트: `backend/test/health.test.ts`의 기대값을 바꿨고, `frontend/src/app.test.tsx`에 상단 홈 링크가 "자격증 관리"로 보이는지 확인하는 테스트를 추가했다.

고치지 않은 것:

- `scripts/push-repositories.ps1`, `scripts/backup.ps1`은 중앙 관리 파일이 됐고, 중앙 동기화(#29)로 이미 옛 이름이 없다.
- 과거 기록(`docs/changes/`, `docs/daily/`)은 당시 상태라 고치지 않았다.
- `docs/research/english-content-sources.md` 파일 이름과 설계 문서의 "영어 공부 영역"은 기능 이름이다.

## 검증

- `node --test scripts/test/claude-skills.test.mjs`: pass 4, fail 0
- `node scripts/claude-skills.mjs`: `.claude/skills matches skills/.`
- `node .standards/lockfiles.mjs`: `frontend/`, `backend/` lockfile 모두 루트와 같음
- 사용자가 `volta run --node 24.21.0 --npm 11.19.0 npm ci --ignore-scripts`로 설치했다. 손으로 고친 lockfile로 `added 475 packages`, 오류 없이 설치됐다(lockfile 이름 변경 확인)
- `node .standards/ioc-scan.mjs`: 의심 항목 없음
- `node .standards/check.mjs`: 통과(중앙 `project-standards@83b6d06`). 설치 전에는 공유 패키지 미설치 4건으로 실패했다
- `npm run check`: 통과(exit 0). 포맷·lint·타입 통과, 백엔드 pass 10·skip 2(DB 통합), 프런트 22파일 68개 통과, 스킬 4개 통과, 빌드 성공
- DB 통합 테스트: 임시 컨테이너 `postgres:17-alpine`에 `database/migrations`를 적용하고 `TEST_DATABASE_URL=… npm test -w backend` → pass 12, fail 0, skip 0
- 브라우저(Playwright, Vite 5206 + 백엔드 3106 + 임시 DB): 모바일 390×844, PC 1440×900에서 탭 제목·상단 제목·하단 문구가 "자격증 관리", `/api/health`의 `service`가 `cert-manager`, 가로 넘침 없음
- 스킬 frontmatter: `quick_validate.py`는 Python `yaml` 모듈이 없어 실행하지 못했다. 같은 규칙(폴더 이름과 `name` 일치, 소문자·숫자·하이픈, 설명 1024자 이하·꺾쇠 없음)을 셸로 확인해 3개 모두 통과
- `git grep -n -i "english" -- . ':!docs/changes' ':!docs/daily'`: 남은 결과는 자격증 분류 값 `english`(코드·테스트·마이그레이션·설계 문서), `docs/research/english-content-sources.md` 링크, 중앙 관리 스킬 `std-communication`의 "English material"뿐이다.

## 자동 코드 리뷰 — 2026-10-30

- 1차(읽기 전용 리뷰 에이전트): 막는 결함 없음. 지적 1건은 `frontend/public/offline.html`의 "자격증 관리은(는)" 조사 표기였다. 중앙 관리 파일이고 이 PR에서 바꾸지 않은 파일이라 반영하지 않았다. 이 리뷰는 셸 없이 작업 트리만 읽어 diff 전체를 보지 못했다.
- 2차(diff를 직접 본 리뷰 에이전트): 결함 없음. 중앙 관리 파일 미변경, compose 볼륨 선언·마운트 일치, `psql -U cert -d cert`와 `.env.example` 일치, `.claude/skills` 복제본이 원본과 같음, lockfile은 이름·링크만 바뀜, 다음 작업 표는 #27 행 삭제와 번호만 바뀜을 확인했다.
- 반영한 보완 커밋: 없음. 리뷰는 2회로 마쳤다.
