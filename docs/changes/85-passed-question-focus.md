# #85 합격 변경 질문을 닫은 뒤 포커스 돌려보내기

이슈: [#85](https://github.com/sirloinbh/cert-manager/issues/85)

## 목적

"목표 상태를 합격으로 바꿀까요?" 질문은 여는 버튼이 없어서, 닫으면 키보드 포커스가 페이지 처음으로 빠졌다. [project-standards#356](https://github.com/sirloinbh/project-standards/issues/356)에서 `ConfirmDialog`에 `returnFocusRef`를 더했고, 이 리포에 동기화됐다.

## 변경

`frontend/src/exam-attempts.tsx`의 질문 상자에 `returnFocusRef`로 "응시·취득 기록" 제목을 넘겼다.

제목으로 정한 이유: 이 질문은 기록 폼을 저장한 뒤에 열린다. 폼을 연 버튼은 첫 기록을 저장하면 사라지지만 제목은 항상 있고, 방금 저장한 기록 바로 위에 있다.

## 검증

- 화면 테스트: `frontend/src/exam-attempts.test.tsx`의 "바꾸기"와 "그대로 두기" 테스트에 포커스 확인을 더했다. `returnFocusRef`를 빼고 돌리면 "그대로 두기" 테스트가 실패함을 확인했다.
- `npm run check`(임시 PostgreSQL 17의 `cert_test` 사용): 통과. 백엔드 118개 통과, 건너뜀 0개. 프론트엔드 239개 통과, 2개 건너뜀. 스킬 검사 4개 통과
- `npm run knip`, `node .standards/check.mjs`: 통과

브라우저에서는 확인하지 않았다. jsdom 테스트로만 포커스를 확인했다.
