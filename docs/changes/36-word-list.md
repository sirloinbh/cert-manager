# #36 자주 쓰는 영어 단어장과 어원 분석 만들기

- 이슈: [#36](https://github.com/sirloinbh/cert-manager/issues/36)
- 브랜치: `feat/36-word-list`
- 설계: [서비스 범위와 데이터 구조](../design/scope-and-data-model.md) 6절, 자료: [영어 공부 자료 출처](../research/english-content-sources.md) 4~6절

## 사용 순서

모두 `DATABASE_URL`의 DB에 쓰고, 시작할 때 대상 DB를 출력한다.

1. `npm run words:import -w backend`: NGSL 1.2 목록을 받아 넣는다. 원본은 `.local/sources/`에 둔다.
2. `npm run words:etymology -w backend`: 단어마다 Wiktionary 어원을 찾아본다. 처음에는 약 1시간 걸리고, 끊어도 다음 실행이 남은 단어부터 받는다.
3. `npm run words:export -w backend -- 50`: 어원을 찾아봤고 뜻이 없는 단어를 빈도 순으로 `.local/word-batches/`에 내보낸다.
4. 파일의 뜻, 예문, 어원 요소를 Claude Code 세션에서 채운다.
5. `npm run words:fill -w backend`: 파일 하나를 통째로 저장하고 `imported/`로 옮긴다. 맞지 않는 파일은 이유를 출력하고 저장하지 않는다.

## 판단

| 항목              | 판단                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 범위              | 이 이슈는 표, 스크립트, API, 화면까지다. 2,809단어를 채우는 일은 세션 여러 번이 필요해 후속 이슈로 나눴다                   |
| 어원 받기         | 3.2GB 전체 덤프(폐기 예정 표시)가 아니라 kaikki.org의 단어별 파일을 1초 간격으로 받는다                                     |
| 어원 원문         | 맨 앞의 자동 생성 계보 줄을 빼고 문장만 저장한다. 품사별로 같은 글은 한 번만 넣는다                                         |
| 원본 파일         | NGSL CSV만 `.local/sources/`에 둔다. 단어별 파일은 어원 글만 DB에 넣고 버린다                                               |
| 스프레드시트 흔적 | 원본의 `TRUE`, `FALSE`를 소문자로 고치고 `I`는 그대로 둔다                                                                  |
| 라이선스          | NGSL은 사이트 표기대로 CC BY-SA 4.0. kaikki.org에는 표기가 없어 Wiktionary 저작권 문서의 CC BY-SA 4.0을 기록한다            |
| 어원 요소         | 어원 자료가 없는 단어에는 넣을 수 없다. 같은 `key`는 같은 요소이고 처음 쓴 뜻을 유지한다                                    |
| 이미 채운 단어    | 들여오기가 덮어쓰지 않고 파일을 거부한다                                                                                    |
| 목록              | 2,809행을 한 번에 받아 화면에서 검색하고 100개씩 보여 준다                                                                  |
| 공통 코드         | 요청 간격과 재시도를 `polite-fetch.ts`로 옮겨 가사 받기와 함께 쓴다. 이 과정에서 가사 받기도 `503`에 기다렸다 다시 시도한다 |

## 변경 — 2026-11-01

- DB: `database/migrations/008_words.sql`. `words`, `morphemes`, `word_morphemes`. `import_sources`는 #35에서 만들었다.
- 스크립트: `backend/src/word-list.ts`, `import-word-list.ts`, `word-etymology.ts`, `import-etymology.ts`, `word-files.ts`, `export-words.ts`, `import-words.ts`, `polite-fetch.ts`.
- API: `backend/src/routes/words.ts`. `GET /api/words`, `GET /api/words/:id`.
- 화면: `frontend/src/words.tsx`, `word-data.ts`, `app.tsx`의 `/words`, `/words/:id`. 두 화면 아래에 출처와 라이선스를 적는다.
- 이 PC의 앱 DB `cert`: 2,809단어를 넣었고 어원 찾아보기를 실행했다.

## 테스트

| 파일                                     | 검증한 동작                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/word-list.test.ts`         | 목록 읽기와 스프레드시트 흔적, 잘못된 파일 거부, 항목 주소, 계보 줄 제거와 중복 제거, 가짜 서버의 200·404·503, 중단 조건, 응답을 출력하지 않음, DB 오류 시 중단                                                           |
| `backend/test/words.integration.test.ts` | 실제 DB에서 목록 재실행, 어원을 안 찾아본 단어는 안 내보냄, 찾음과 없음 표시, 잘못된 파일 7가지, 요소 공유와 처음 뜻 유지, 이미 채운 단어 거부, API의 빈도 순서·출처·같은 어근·404·400, 쓰이는 요소 삭제 거부, `key` 규칙 |
| `frontend/src/words.test.tsx`            | 검색 규칙, 목록과 출처, 100개씩 보기, 검색어 유지, 빈 목록, 실패, 상세 표시, 요소를 누르면 같은 어근의 단어, 단어를 옮기면 선택 초기화, 안 채운 단어, 어원 자료 없음, 없는 단어                                           |

## 검증

- `TEST_DATABASE_URL=… npm run check`: 결과는 PR에 적는다.
- 실제 자료: `words:import`를 실제 사이트로 실행해 2,809단어를 받았다(순위 1~2809 빠짐없음). `words:etymology`는 `cert`에서 실제로 실행했다.
- 브라우저: 헤드리스 Edge로 Vite 5206 + 백엔드 3106 + `cert_test`에서 확인했다. 단어 목록은 실제 NGSL이고, 뜻과 어원 요소는 확인용으로 네 단어에만 넣었다가 지웠다.
  - 모바일 390×844, PC 1440×900: 목록, 더 보기, 검색, 상세, 요소를 눌러 같은 어근 보기, 출처 표기. 콘솔 오류·경고 없음, 가로 넘침 없음.

## 한계

- 뜻, 예문, 어원 요소는 아직 대부분 비어 있다. 후속 이슈에서 빈도 순으로 채운다.
- 어원 요소와 뜻은 AI가 만든 값이라 틀릴 수 있다. 화면에 "AI 정리"로 표시하고 Wiktionary 원문을 함께 보여 준다.
- 이 앱을 외부에 공개하면 CC BY-SA 4.0에 따라 출처 표기를 유지하고, 고친 목록은 같은 라이선스로 배포해야 한다.
