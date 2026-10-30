# #45 다음 작업 문서의 보안 PR #15 안내 고치기

- 이슈: [#45](https://github.com/sirloinbh/cert-manager/issues/45)
- 결정: [sirloinbh/project-standards#307](https://github.com/sirloinbh/project-standards/issues/307) 후보 A, project-standards `docs/research/zod4.md` 결정 절

## 목적

다음 작업 문서가 PR #15(`zod` 3 → 4) 처리를 1순위로 안내했고, [#27](27-rename-to-cert-manager.md)에서는 lockfile을 다시 만들라는 내용까지 더했다. 중앙 결정과 다른 안내이므로 바로잡는다.

## 변경 — 2026-10-30

- `docs/next-steps/README.md`: 표에서 PR #15 행을 빼고 번호를 다시 매겼다. "함께 볼 것"에 결정과 이 앱의 노출 여부를 적었다.

## 검증

- `git grep -n "z\.array\|\.array(" -- backend/src`: 결과 없음
- `node .standards/check.mjs`: 통과, zod 배열 경고 없음
- `npm audit --omit=dev`: zod high 1건(GHSA-mrhx-c7xc-m3w5). 결정대로 남아 있다
- `npm run format:check`: 통과

## 제한

코드는 바꾸지 않았다. PR #15는 결정대로 열어 둔다.

## 자동 코드 리뷰 — 2026-10-30

- 1차(읽기 전용 리뷰 에이전트): 결함 없음. 결정 내용과 날짜, 중앙 관리 값, `z.array` 없음, 메시지 개수 제한(`MAX_ISSUES = 10`), 표에서 PR #15 행만 빠졌는지를 원본과 대조했다. 보완 커밋이 없어 2차 리뷰는 하지 않았다.
