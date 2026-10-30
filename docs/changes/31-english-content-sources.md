# #31 팝송 가사·번역과 영어 단어·어원 자료 가져올 방법 조사하기

- 이슈: [#31](https://github.com/sirloinbh/cert-manager/issues/31)
- 브랜치: `docs/31-english-content-sources`

## 목적

영어 공부 영역의 기능(#35 팝송 가사 보기, #36 단어장과 어원, #37 오늘의 단어)을 만들기 전에, 자료를 어디서 어떻게 가져올지 정한다.

## 변경 — 2026-10-30

- `docs/research/english-content-sources.md`를 새로 썼다. 가사 원문, 번역, 곡 목록, 곡 범위, 단어 목록, 어원, 저장 위치마다 정한 방법과 이유, 출처를 적었다.
  - 유튜브 뮤직은 공식 가사 API가 없고, YouTube 약관이 자동화된 접근을 금지해 쓰지 않는다. 가사 원문은 LRCLIB에서 받는 방식을 추천했다.
  - 번역은 가져올 때 Claude API로 한 번 하고 DB에 저장하는 방식을 추천했다(아래 "사용자 결정 반영"에서 바뀜).
  - 리포가 공개 리포라서, 가사 원문과 번역은 로컬 DB에만 두는 규칙을 적었다.
- 이어지는 이슈: Claude API를 쓰려면 이 앱의 레지스트리 `features.claude`를 켜야 해서 [sirloinbh/project-standards#351](https://github.com/sirloinbh/project-standards/issues/351)을 등록했다. 키 발급은 이미 있는 사용자 단계 [project-standards#266](https://github.com/sirloinbh/project-standards/issues/266)을 따른다.
- `README.md` 문서 목록에 조사 문서 링크를 넣었다.
- `docs/next-steps/README.md`: "세부 요구사항 이슈 카드 등록"이 끝나(#30~#38) 표를 고쳤다.
- `docs/daily/2026-10-30.md`를 새로 쓰고 목록에 넣었다.

사용자 확인이 필요한 결정(가사 출처, 번역 방식, 곡 범위)은 이슈 #31 댓글에 기록했다.

## 사용자 결정 반영 — 2026-10-30

- 사용자가 가사 출처는 LRCLIB, 곡 범위는 정규 12장 + From the Vault 곡으로 추천안을 골랐다. 번역은 추천안(Claude API 일괄 번역) 대신 **Claude Code 세션에서 번역**하기로 정했다.
- 조사 문서의 결론 표와 2절을 세션 번역 순서(`.local/translations/` 내보내기 → 세션에서 번역 → 줄 수 확인 후 들여오기)로 고쳤다. 단어 뜻·어원 정리도 같은 방식으로 맞췄다.
- 앱이 Claude API를 쓰지 않으므로 [project-standards#351](https://github.com/sirloinbh/project-standards/issues/351)을 not planned로 닫았다. 조사 문서의 "이어지는 이슈" 절과 Claude API 키 관련 문장을 지웠다.
- 이어지는 기능 이슈 #35, #36의 할 일을 결론에 맞게 고쳤다(이슈 본문 수정).
- `docs/next-steps/README.md`: 결정이 끝나 "#31 결정 확인" 줄을 지웠다.

## 검증

문서만 바뀌어 앱 테스트는 추가하지 않았다.

- Prettier 3.9.10(lockfile과 같은 버전, 예전 폴더에 이미 설치된 것)로 바꾼 Markdown 6개를 포맷했다. 3개 파일의 표 정렬이 바뀌었다. 새 패키지는 설치하지 않았다.
- 링크 검사: 바뀐 문서 6개의 상대 링크 21개가 모두 있는 파일을 가리킨다.
- `node .standards/secret-scan.mjs`: 의심 항목 없음.
- `node .standards/check.mjs`: 공유 패키지 4개가 설치되어 있지 않다는 항목만 나왔다. 새 폴더 `cert-manager`에 `node_modules`가 없어서다(#26 남은 사용자 단계). 문서 변경과는 관계없다.
- `npm run check`: 실행하지 못했다. `node_modules`가 없고, 설치는 사용자 승인이 필요하다. 포맷 검사를 포함한 전체 검사는 GitHub Actions 결과로 확인한다.

## 1차 자동 리뷰 반영 — 2026-10-30

PR #39의 1차 리뷰(작성 맥락과 분리된 읽기 전용 에이전트)에서 높음·중간 지적은 없었고, 낮음 4건이 나왔다.

- LRCLIB `/api/get`의 필수 값(`track_name`, `artist_name`)과 선택 값(`album_name`, `duration`)을 나눠 적었다.
- "요청 사이 200~500ms"는 근거를 못 찾았다는 지적이었다. LRCLIB `docs.md` 원문에 "add a short delay between requests (200–500 ms)"가 있어 문장을 그대로 두었다.
- 저작권 절에 "법적 허용 판단이 아니라 운영 규칙"이라고 적고, 세션 번역도 가사를 Claude Code(Anthropic) 쪽으로 보낸다는 점을 2절에 적었다.
- 포맷 명령: 예전 폴더 `english-study.old`의 Prettier를 쓴 방법을 아래 검증 절에 명령으로 적었다.

## 검증 — 리뷰 반영 후

- 포맷: 바뀐 Markdown마다 `english-study.old` 폴더에서 `node node_modules/prettier/bin/prettier.cjs --stdin-filepath <예전 폴더 안의 같은 경로>`로 표준 입력을 포맷해 결과를 덮어썼다. 그 폴더의 `prettier.config.mjs`는 이 리포와 같다(`diff` 결과 차이 없음). 새 폴더에는 `@sirloinbh/prettier-config`가 설치되어 있지 않아 이 방법을 썼다.
