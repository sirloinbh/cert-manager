# #28 자격증 관리 서비스의 기능 범위와 데이터 구조 정하기

- 이슈: [#28](https://github.com/sirloinbh/cert-manager/issues/28)
- 브랜치: `docs/28-scope-data-model`

## 목적

첫 기능(#30 목표 등록부터)을 만들기 전에 서비스 범위, 화면, 테이블과 날짜·NULL 규칙을 정한다. `docs/next-steps/README.md`의 "첫 기능의 DB 마이그레이션 `002` 설계"가 이 결정을 기다렸다.

## 변경 — 2026-10-30

- `docs/design/scope-and-data-model.md`를 새로 썼다.
  - 범위: 자격증 영역, 영어 공부 영역(자격증과 별개, #25 결정), 대시보드. 범위 밖(로그인, 알림, 외부 공개)도 적었다.
  - 화면: 메뉴 5개와 주소 목록, 화면마다 담당 이슈.
  - 테이블: 자격증 영역 4개, 영어 공부 영역 9개와 열 추가 1건(1차 리뷰 뒤 `import_sources`를 더해 10개). 열마다 형, NULL의 뜻, `CHECK`, 삭제 동작을 적었다. 마이그레이션 번호는 예상값이고 착수할 때 정한다.
  - 계산값(만료 상태, 목표 달성, 진행률, 오늘 할 일, 가사 상태)은 저장하지 않고 계산한다고 정했다. 가사 상태는 처음에 "번역 있음" 하나였고 1차 리뷰 뒤 세 상태로 나눴다.
- 사용자 결정 4가지를 문서 2절과 이슈 #28 댓글에 기록했다: 목표 상태는 직접 고르고 합격 기록 때 바꿀지 묻기, 합격 판정은 직접 입력, 만료 임박은 90일, 메뉴는 기능별 5개.
- 이어지는 기능 이슈 #30, #32, #33, #35, #36, #37 본문에 이 문서의 해당 절과 결정을 반영했다.
- `docs/next-steps/README.md`: 끝난 #26 줄을 지우고, 다음 작업으로 #30(뒤이어 #32·#33)과 #34를 넣었다. 영어 공부 #35·#36·#37은 #30 다음으로 적었다.
- `README.md` 문서 목록에 설계 문서 링크를 넣었다. `docs/daily/2026-10-30.md`에 오늘 한 일을 더했다.

## 검증

문서만 바뀌어 앱 테스트는 추가하지 않았다.

- 포맷: 이 폴더에 설치된 Prettier(`node node_modules/prettier/bin/prettier.cjs --write`)로 바꾼 Markdown 5개를 맞췄다.
- 링크 검사: 바뀐 문서 5개의 상대 링크 18개가 모두 있는 파일을 가리킨다.
- `npm run check` (Node 24.21.0 / npm 11.19.0): 통과. 포맷·lint·타입 통과. 백엔드 테스트 5개 중 4개 통과·1개 건너뜀(`TEST_DATABASE_URL` 미설정, 성공으로 세지 않음), 프런트엔드 52개 통과, 스킬 4개 통과, 빌드 성공.
- `node .standards/secret-scan.mjs`: 의심 항목 없음. `node .standards/check.mjs`: 통과.
- 테이블 설계는 문서이고 마이그레이션은 아직 없다. SQL로 실제 적용해 본 것은 아니므로, `CHECK`·키 규칙은 각 기능 이슈의 마이그레이션과 DB 통합 테스트에서 확인한다.

## 1차 자동 리뷰 반영 — 2026-10-30

PR #40의 1차 리뷰(작성 맥락과 분리된 읽기 전용 에이전트)에서 높음 0, 중간 6, 낮음 4건이 나왔다. 모두 이 PR에서 설계 문서를 고쳤다.

- 중간: 순서 맞바꾸기가 `UNIQUE (…, position)`에 막힌다. 순서 UNIQUE를 `DEFERRABLE INITIALLY DEFERRED` 제약으로 정하고 이유를 4절에 적었다.
- 중간: "번역 있음"이 가사 없는 곡에도 참이 된다. 가사 상태를 "가사 없음 / 번역 전 / 번역 있음" 셋으로 나눴다.
- 중간: `expires_on`의 `NULL`이 "만료 없음"과 "모름"을 함께 뜻해 #32 완료 기준("만료 없음" 표시)과 어긋났다. `validity_kind`·`outcome`으로 나누는 표시 규칙 표를 넣었다.
- 중간: `etymology_source`의 `NULL`이 "아직 안 찾음"과 "자료 없음"을 함께 뜻했다. 자료 없음은 `''`로 정했다.
- 중간: 어원 요소 `UNIQUE (form, kind, meaning_ko)`는 세션마다 뜻 문장이 달라지면 같은 어근이 갈라진다. 고정 이름 `key`(예: `root:port`)를 두고, 내보낼 때 기존 요소 목록을 함께 넘기도록 했다.
- 중간: 조사 문서 6절의 "출처 URL·받은 날짜 저장"이 빠졌다. `import_sources` 테이블과 `songs.lyrics_source_url`, `words`의 출처 연결 열을 넣었다.
- 낮음: 결과 전에도 `''`인 열(`grade`, `part_of_speech`, `origin`)을 `NULL` 허용으로 바꿨다.
- 낮음: 초·개월 단위 기간이 중앙 규칙(분 단위)과 다르다. 4절에 예외와 이유를 적고 중앙 이슈 [project-standards#353](https://github.com/sirloinbh/project-standards/issues/353)을 등록했다.
- 낮음: 만료일 계산의 말일 보정(`2024-02-29` + 24개월 = `2026-02-28`), `expires_on`이 마지막 유효일이라는 뜻, 운전면허 처리를 적었다. 마지막 유효일을 더한 날로 할지 전날로 할지는 #32에서 공식 안내로 정한다.
- 낮음: #28 할 일의 후보(시험 회차·접수, 공부 기록, 갱신일, 일정 화면)를 다룰지 1절 표로 정했다. 변경 기록의 테이블 수와 next-steps 설명을 바로잡았다.

검증(1차 반영 후): Prettier `--check .` 통과. 바뀐 문서 5개의 상대 링크 19개가 모두 있는 파일을 가리킨다(`import_sources` 절의 조사 문서 링크 1개 추가). `secret-scan` 의심 항목 없음. `npm run check` 통과(결과 수치는 첫 검증과 같음).

## 2차 자동 리뷰 반영 — 2026-10-30

2차 리뷰에서 1차 지적 10건이 문서에 들어간 것을 확인했고, 새 지적 7건(중간 2, 낮음 5)이 나왔다. 모두 이 PR에서 고쳤다. 3차 리뷰는 하지 않는다.

- 중간: "지연 제약은 `ALTER TABLE … ADD CONSTRAINT`로만 만들 수 있다"가 틀렸고, 그대로 쓰면 다시 적용할 때 실패한다(`ADD CONSTRAINT`에 `IF NOT EXISTS`가 없음). `CREATE TABLE IF NOT EXISTS` 안의 표 제약으로 쓰고, 나중에 붙일 때만 `pg_constraint`를 확인하는 `DO` 블록을 쓴다고 고쳤다.
- 중간: 어원 요소 `key` 예시(`root:port`, `root:port:carry`)가 같은 어근을 둘로 나눴다. 먼저 만든 요소는 `<kind>:<form>`, 나중에 나온 다른 뜻의 요소에만 접미사를 붙이고 기존 `key`는 바꾸지 않는 규칙과 형식 `CHECK`를 적었다. 예시는 `root:port`(나르다)와 `root:port:harbor`(항구).
- 낮음: 지연 UNIQUE를 `study_stages`·`study_tasks`에만 쓰고, `album_tracks`·`word_morphemes`·`daily_words` 키는 지연하지 않는다고 적었다(`ON CONFLICT`가 지연 제약을 판정에 쓰지 못함).
- 낮음: NULL 뜻을 맞췄다. 숫자·날짜 열은 `NULL` 하나로 두고 다른 열로 구분한다는 규칙, `lyrics_source_url`(직접 넣으면 `''`), `etymology_url`·`etymology_source_id`·`list_source_id`의 뜻.
- 낮음: `import_sources`는 스크립트 실행 한 번에 한 행이고, 화면 이름은 `kind`를 바꿔 보여 준다고 정했다. 곡 쪽 행은 참조하지 않는 실행 이력이다.
- 낮음: 재응시로 기록이 여러 개면 만료 카드는 가장 늦은 `passed`·`scored` 기록만 쓴다. `validity_kind`가 `none`이면 `expires_on`을 비운다.
- 낮음: 변경 기록의 계산값 목록에 남아 있던 "번역 있음"을 "가사 상태"로 고쳤다.

검증(2차 반영 후): Prettier `--check .` 통과(`npm run check` 안에서). 상대 링크 19개 정상. `secret-scan` 의심 항목 없음. `npm run check` 통과: 백엔드 4개 통과·1개 건너뜀(`TEST_DATABASE_URL` 미설정, 성공으로 세지 않음), 프런트엔드 52개, 스킬 4개 통과, 빌드 성공. 지연 UNIQUE·`CHECK` 문장은 SQL로 적용해 보지 않았고, #33·#36 마이그레이션의 DB 통합 테스트에서 확인한다.
