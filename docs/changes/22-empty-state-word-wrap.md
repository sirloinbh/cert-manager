# #22 모바일 빈 화면 안내 문구 단어 단위 줄바꿈

이슈: [#22](https://github.com/sirloinbh/cert-manager/issues/22)

## 목적

390×844 화면에서 빈 화면 안내 문구가 "추가합니 / 다."처럼 단어 중간에서 끊겼다.

## 변경 내용

- `EmptyState`를 부르는 7곳에 `className="break-keep"`을 넣었다. `app.tsx`, `certifications.tsx`, `exam-attempts.tsx`, `songs.tsx` 2곳, `study-plan.tsx`, `words.tsx`다.
- 이슈는 `app.tsx`만 적었지만, 그 뒤 기능이 생겨 같은 컴포넌트를 쓰는 다른 화면에도 같은 문제가 생길 수 있어 함께 고쳤다.
- 중앙 관리 파일 `components/ui/empty-state.tsx`는 바꾸지 않았다.
- `frontend/src/app.test.tsx`: 안내 문구에 `break-keep`이 붙는지 확인한다.
- `docs/next-steps/README.md`: #22를 빼고 #70 상태를 고쳤다.

## 검증

`TEST_DATABASE_URL`을 `cert_test`로 지정하고 실행했다.

- `npm run check`: 통과. 백엔드 108개 통과, 프런트엔드 236개 통과·2개 건너뜀(`DARK_ONLY`), 스킬 4개 통과, 빌드 성공.
- `npm run knip`: 결과 없음.
- `node .standards/check.mjs`: 통과.
- `node .standards/secret-scan.mjs`: 의심 항목 없음.
- 화면: 헤드리스 Edge로 `/settings`, `/certifications`, `/songs`, `/words`의 빈 화면을 390×844, 1440×900에서 확인했다. 네 화면 모두 계산된 `word-break`가 `keep-all`이고 가로 넘침이 없다. 390×844의 `/settings`는 스크린샷을 눈으로 확인했다.

## 제한·후속 작업

- 다른 앱의 같은 문제는 확인하지 않았다. 그래서 project-standards에 `EmptyState` 기본값 변경을 제안하지 않았다.
