# #20 #10 검증 기록 보완과 일일·다음 작업 문서 최신화

- 이슈: [#20](https://github.com/sirloinbh/english-study/issues/20)
- 브랜치: `docs/20-docs-records-catch-up`

## 목적

project-standards 준수 점검(2026-10-29)에서 빠진 문서 기록 3가지를 확인했다.

- `docs/changes/10-design-system.md`에 `npm run check` 전체 결과와 모바일·PC 브라우저 확인이 없다(`AGENTS.md` 검증 명령).
- `docs/daily/`에 2026-10-19 이후 기록이 없다.
- `docs/next-steps/README.md`가 2026-10-19에 멈춰 있다.

## 변경 — 2026-10-29

- `docs/changes/10-design-system.md`: "검증 보완" 절 추가. `npm run check` 결과, 390×844·1440×900 브라우저 확인 결과, 관찰한 줄바꿈 문제와 확인하지 못한 범위를 적었다.
- `docs/daily/`: 2026-10-26·27·28·29 기록을 새로 쓰고 `README.md` 목록에 넣었다. 이슈에는 26일·29일만 적었지만, 작업일마다 파일을 만드는 규칙에 따라 PR #12~#14가 병합된 27일·28일도 넣었다.
- `docs/next-steps/README.md`: 보안 업데이트 PR #15(CI 실패)를 1순위로 올리고, `knip` 결과와 줄바꿈 문제, 로컬 Node 버전 차이를 "함께 볼 것"에 적었다.

## 검증

문서만 바뀌어 앱 테스트는 추가하지 않았다.

- `npm run format:check`: 처음에 표 정렬 때문에 2개 파일이 걸렸고, Prettier로 맞춘 뒤 통과했다.
- 링크 검사: 바뀐 문서의 상대 링크 12개가 모두 존재하는 파일을 가리킨다.
- `npm run check` (Node 24.21.0 / npm 11.19.0, 이 브랜치): 통과. 백엔드 4개 통과·1개 건너뜀(`TEST_DATABASE_URL` 미설정, 성공으로 세지 않음), 프론트엔드 52개 통과, 스킬 4개 통과, 빌드 성공.

- 브라우저 확인 방법과 결과는 [#10 변경 기록](10-design-system.md)의 "검증 보완" 절에 있다. 확인에 쓴 임시 DB 컨테이너, API·Vite 서버, Chrome은 확인 후 모두 종료했다.
