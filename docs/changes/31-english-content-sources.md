# #31 팝송 가사·번역과 영어 단어·어원 자료 가져올 방법 조사하기

- 이슈: [#31](https://github.com/sirloinbh/cert-manager/issues/31)
- 브랜치: `docs/31-english-content-sources`

## 목적

영어 공부 영역의 기능(#35 팝송 가사 보기, #36 단어장과 어원, #37 오늘의 단어)을 만들기 전에, 자료를 어디서 어떻게 가져올지 정한다.

## 변경 — 2026-10-30

- `docs/research/english-content-sources.md`를 새로 썼다. 가사 원문, 번역, 곡 목록, 곡 범위, 단어 목록, 어원, 저장 위치마다 정한 방법과 이유, 출처를 적었다.
  - 유튜브 뮤직은 공식 가사 API가 없고, YouTube 약관이 자동화된 접근을 금지해 쓰지 않는다. 가사 원문은 LRCLIB에서 받는 방식을 추천했다.
  - 번역은 가져올 때 Claude API로 한 번 하고 DB에 저장하는 방식을 추천했다.
  - 리포가 공개 리포라서, 가사 원문과 번역은 로컬 DB에만 두는 규칙을 적었다.
- 이어지는 이슈: Claude API를 쓰려면 이 앱의 레지스트리 `features.claude`를 켜야 해서 [sirloinbh/project-standards#351](https://github.com/sirloinbh/project-standards/issues/351)을 등록했다. 키 발급은 이미 있는 사용자 단계 [project-standards#266](https://github.com/sirloinbh/project-standards/issues/266)을 따른다.
- `README.md` 문서 목록에 조사 문서 링크를 넣었다.
- `docs/next-steps/README.md`: "세부 요구사항 이슈 카드 등록"이 끝나(#30~#38) 표를 고쳤다.
- `docs/daily/2026-10-30.md`를 새로 쓰고 목록에 넣었다.

사용자 확인이 필요한 결정(가사 출처, 번역 방식, 곡 범위)은 이슈 #31 댓글에 기록했다.

## 검증

문서만 바뀌어 앱 테스트는 추가하지 않았다.
- Prettier 3.9.10(lockfile과 같은 버전, 예전 폴더에 이미 설치된 것)로 바꾼 Markdown 6개를 포맷했다. 3개 파일의 표 정렬이 바뀌었다. 새 패키지는 설치하지 않았다.
- 링크 검사: 바뀐 문서 6개의 상대 링크 21개가 모두 있는 파일을 가리킨다.
- `node .standards/secret-scan.mjs`: 의심 항목 없음.
- `node .standards/check.mjs`: 공유 패키지 4개가 설치되어 있지 않다는 항목만 나왔다. 새 폴더 `cert-manager`에 `node_modules`가 없어서다(#26 남은 사용자 단계). 문서 변경과는 관계없다.
- `npm run check`: 실행하지 못했다. `node_modules`가 없고, 설치는 사용자 승인이 필요하다. 포맷 검사를 포함한 전체 검사는 GitHub Actions 결과로 확인한다.
