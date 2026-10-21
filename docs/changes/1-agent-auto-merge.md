# CI 통과 PR 에이전트 병합 정책으로 변경 (#1)

- 이슈: https://github.com/sirloinbh/english-study/issues/1
- 일자: 2026-10-21 (Asia/Seoul)

## 목적

저장소 소유자 요청(2026-10-21)에 따라 PR 병합 정책을 "사용자만 병합"에서 "필수 CI 통과 시 에이전트가 merge commit으로 병합"으로 바꾼다.

## 변경

- 새 정책: 필수 CI 검사가 모두 통과하면 에이전트(주 에이전트·로컬 워커)가 `scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <검증한 head SHA>`로 merge commit 병합하고 연결된 이슈가 닫혔는지 확인한다.
- 순차·스택 PR은 앞 PR 병합 후 다음 브랜치에 `origin/main`을 병합해 충돌을 해결하고 관련 테스트를 다시 실행한 뒤 일반 푸시(force 금지), CI 통과 후 병합한다.
- 계속 금지: 실패·실행 중 검사 상태의 병합, `--admin`·브랜치 보호 우회, 자기 PR 승인으로 검토 대체, `main` 직접 푸시, force push.
- 현재 `main` 병합은 자동 배포와 연결되어 있지 않음을 명시하고, 배포가 연결되면 병합 후 결과를 확인하도록 적었다.
- 수정 파일: `AGENTS.md`(절차 5), `README.md`(진행 순서), `docs/project-setup.md`(절대 규칙 2, Git 전략 순서·병합, 파일 역할 표, AGENTS 템플릿), `skills/english-study-{implementation,foundation,testing}/SKILL.md`(implementation의 YAML description 포함), `npm run skills:sync`로 갱신한 `.claude/skills/` 복제본.
- `docs/project-setup.md`의 "squash merge 추천"은 새 정책에 맞춰 merge commit 병합으로 바꿨다.
- 이력 기록(`docs/changes/bootstrap.md`, `docs/daily`)은 변경하지 않았다.

## 검증

- `npm run skills:sync`: `.claude/skills/` 갱신.
- `npm run test:skills`: **4 pass / 0 fail / 0 skip**.
- skill-creator `quick_validate.py`(`PYTHONUTF8=1`)를 `skills/` 3종과 `.claude/skills/` 3종에 실행: 모두 `Skill is valid!`.
- 포맷: 이 저장소에 `node_modules`가 없어(설치는 사용자 재확인 대상) 같은 버전 Prettier 3.9.10(workout-memo 설치본)으로 변경 파일에 `prettier --check` 실행: 통과.
- 로컬 `npm run check`: `node_modules` 미설치로 `format:check` 단계에서 `prettier` 명령을 찾지 못해 실행 불가. 앱 코드 변경이 없어 앱 테스트는 추가하지 않았고, 전체 검사는 PR의 GitHub Actions `verify`·`docker-build`로 확인한다.
- 링크: 변경 문구에 새 링크를 추가하지 않았다.

## 제한·후속

- 이 PR 자체는 요청에 따라 사용자가 검토·병합한다.

## 2026-10-21 — PR 후 자동 리뷰(최대 2회)

### 변경

- PR을 올린 뒤 자동 코드 리뷰를 최대 2회 거치는 단계를 병합 앞에 추가했다. 리뷰 → 보완 커밋 → 2차 리뷰 → 보완 커밋 순서이며, 2차 보완 커밋 뒤에는 더 리뷰하지 않는다. 보완점이 없으면 바로 CI 확인과 병합으로 간다.
- 이 PR에서 고치기에 큰 수정(범위 밖 기능, 설계·데이터 구조 변경, 여러 모듈 수정, 별도 검증이 필요한 작업)은 새 이슈카드로 분리한다. 분리하면 main이 깨지거나 보안·데이터 손상 위험이 남는 결함은 병합을 보류하고 사용자에게 알린다.
- 각 리뷰 차수의 결과(지적, 반영 커밋, 분리 이슈, 보완점 없음)는 PR 코멘트와 docs 작업 기록에 남긴다. 리뷰 중 새 커밋이 생기면 이전 CI 결과로 병합하지 않고 최종 head의 필수 CI 통과 후 병합한다.
- `skills/english-study-implementation/SKILL.md`: 새 "5. PR 후 자동 코드 리뷰(최대 2회)" 단계를 추가하고 병합 단계를 "6. CI 통과 후 병합"으로 바꿨다. YAML description도 갱신했다.
- 짧은 요약 반영: `AGENTS.md` 절차(5 리뷰, 6 병합), `README.md`, `docs/project-setup.md`(절대 규칙 2·Git 전략 순서·리뷰·병합·파일 역할 표·AGENTS 템플릿), `skills/english-study-{foundation,testing}/SKILL.md`. `.claude/skills/`는 `npm run skills:sync`로 갱신했다.
- 기존 금지 사항(실패·실행 중 검사 상태 병합, `--admin`·브랜치 보호 우회, 자기 PR 승인, `main` 직접 푸시, force push)과 순차·스택 PR 처리는 유지했다.

### 이유

사용자가 PR 후 자동 리뷰 깊이를 최대 2회로 제한하고, 큰 수정은 새 이슈로 분리한 뒤, CI 통과 후 병합하도록 요청했다.

### 검증

| 명령                                                                                          | 결과                                     |
| --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run skills:sync` → `npm run skills:check`                                                | pass (`.claude/skills matches skills/.`) |
| `npm run test:skills`                                                                         | pass 4/0/0 (pass/fail/skip)              |
| `PYTHONUTF8=1 py -3 quick_validate.py` (skill-creator) — `skills/` 3종, `.claude/skills/` 3종 | pass 6/6 (`Skill is valid!`)             |
| Prettier 3.9.10(workout-memo 설치본) `--check` — 변경한 Markdown 파일                         | pass                                     |
| `npm run check`                                                                               | 미실행: `node_modules` 미설치            |

앱 코드 변경이 없어 앱 테스트는 추가하지 않았다. 이 저장소는 `node_modules`가 없고 설치는 사용자 확인 대상이라 설치하지 않았다. 전체 검사는 PR의 GitHub Actions `verify`·`docker-build`로 확인한다.
