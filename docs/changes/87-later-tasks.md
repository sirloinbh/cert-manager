# #87 나중에 할 일 정리

이슈: [#87](https://github.com/sirloinbh/cert-manager/issues/87)

## 목적

사용자가 외출하면서 이어서 할 일을 docs에 남겨 달라고 요청했다.

## 변경 내용

`docs/next-steps/README.md`의 우선 처리에 할 일 6개를 적었다. #64, #70, #80 기록의 제한 사항과 2026-11-02 GitHub 상태에서 가져왔다.

## 검증

- 바뀐 문서에 Prettier 검사를 실행했다. 결과는 PR에 적는다.
- 문서만 고쳐 앱 테스트는 실행하지 않았고, 별도 worktree에는 `node_modules`가 없어 `npm run check`도 실행하지 않았다. 필수 CI로 확인한다.
- 사용자 요청이 PR 올리기까지여서 병합하지 않았고, 자동 리뷰도 하지 않았다.

## 2026-11-03 이어서 한 일과 리뷰 반영

다음 날 에이전트가 할 일 3개를 끝내고 표에서 뺐다.

- PR #86: 독립 리뷰의 지적 2건(기록 문장, Escape 테스트)을 반영하고 병합했다. 상세는 [#85 기록](85-passed-question-focus.md)에 있다.
- project-standards#390: 15초 측정 조건을 정정하는 코멘트를 달았다.
- 다른 앱: 중앙 목록에서 vitest를 쓰는 앱 8개의 main을 GitHub API로 읽어, 모두 `frontend/vitest.config.ts`에 `testTimeout: 15_000`이 있음을 확인했다.

이 PR의 독립 리뷰 지적도 반영했다. 끝난 일이 할 일로 남아 있던 점, 가사 요청이 없었다고 단정한 문장, project-standards#390에 링크가 없던 점이다.

- Prettier 검사: 통과. `npm run check`(이 PC의 `cert_test`): 통과. 백엔드 118개, 프론트엔드 240개 통과·2개 건너뜀, 스킬 4개. `node .standards/check.mjs`, `node .standards/secret-scan.mjs`: 통과.
- 리뷰는 1차에서 끝냈다. 문서 표만 고쳤으므로 2차는 하지 않았다.

## 제한·후속 작업

- 가사 받기를 사용자가 이미 실행했는지는 확인하지 않았다. 기록에는 실행했다는 내용이 없다.
