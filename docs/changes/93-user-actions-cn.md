# #93 직접 할 일 알림의 cn() 우회 코드 되돌리기

- `frontend/src/user-actions.tsx`: 기한 문구의 `className`을 `cn()`으로 되돌리고 우회 주석을 지웠습니다.
- 중앙 `cn()` 수정(sirloinbh/project-standards#357)이 #63으로 들어와 `text-caption`이 지워지지 않습니다. `study-plan.tsx`의 같은 우회는 #66에서 지웠습니다.

## 확인

- 화면(Vite 개발 서버, API는 Playwright로 가짜 응답, 헤드리스 Chrome 1440×900·390×844): 알림 패널의 기한 문구는 지난 할 일과 남은 할 일 모두 `14px`/`20px`이고, 지난 할 일만 `text-destructive` 색입니다.
- 자격증 상세의 "삭제"(`text-destructive`)와 "수정" 버튼이 모두 `14px`/`20px`, 높이 `36px`로 같습니다(#357 완료 기준).
- `npm run check` 통과: 포맷·린트·타입 검사·빌드 통과, backend 112개 통과·11개 건너뜀, frontend 240개 통과·2개 건너뜀, 스킬 4개 통과.
- DB 통합 테스트 11개는 실행하지 않았습니다. 로컬에 테스트 DB가 떠 있지 않아 `TEST_DATABASE_URL`을 비우고 돌렸습니다. 이번 변경은 화면 코드 한 줄이라 DB와 관계가 없습니다.
