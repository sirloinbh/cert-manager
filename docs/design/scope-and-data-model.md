# 서비스 범위와 데이터 구조

- 이슈: [#28](https://github.com/sirloinbh/cert-manager/issues/28)
- 작성일: 2026-10-30 (Asia/Seoul)
- 이 문서는 첫 기능들의 설계 초안이다. 각 기능 이슈가 마이그레이션을 만들 때 이 문서를 기준으로 하고, 바뀐 점은 그 이슈의 변경 기록과 이 문서에 함께 고친다.
- 함께 볼 문서: [영어 공부 자료 출처](../research/english-content-sources.md), 중앙 규칙 project-standards `docs/conventions/domain.md`(날짜·시간대·NULL)와 `docs/conventions/database.md`(마이그레이션)

## 1. 범위

서비스는 두 영역과 대시보드로 나뉜다. 영어 공부는 자격증과 별개 영역이다(#25 결정). 토익·토익 스피킹은 자격증 영역의 목표로 다룬다.

| 영역      | 다루는 것                                                   | 이슈                       |
| --------- | ----------------------------------------------------------- | -------------------------- |
| 자격증    | 목표 자격증, 응시·취득 기록과 만료일, 공부 계획(단계·할 일) | #30, #32, #33, #34         |
| 영어 공부 | 팝송 가사 원문·번역, 자주 쓰는 단어와 어원, 오늘의 단어     | #35, #36, #37              |
| 대시보드  | 두 영역의 오늘 볼 것을 모아 보기                            | 각 기능 이슈에서 카드 추가 |

범위 밖: 로그인·여러 사용자, 알림(푸시·메일), 시험 접수 대행, 외부 공개. 사용자는 본인 한 명이다.

#28 할 일에 후보로 적었던 것 중 처음 범위에서 정한 것:

| 후보                   | 처리                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| 시험 회차·접수 기간    | 따로 저장하지 않는다. 목표 시험일(`target_exam_date`)만 두고, 접수 기간은 메모에 적는다. 필요해지면 새 이슈로 |
| 공부 기록(공부한 시간) | 따로 저장하지 않는다. 공부 계획의 할 일 완료(`completed_at`)로 대신한다                                       |
| 점수·합격 결과         | 응시·취득 기록(`exam_attempts`)에 둔다                                                                        |
| 만료·갱신일            | 응시·취득 기록의 만료일(`expires_on`)에 둔다. 운전면허 갱신 기한도 같은 칸을 쓴다                             |
| 일정 화면              | 따로 만들지 않는다. 대시보드의 가까운 시험 카드와 오늘 할 일 카드로 대신한다                                  |

## 2. 사용자 결정 (2026-10-30)

| 항목      | 결정                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| 목표 상태 | 사용자가 직접 고른다. 응시 기록에 "합격"을 넣으면 목표 상태를 "합격"으로 바꿀지 묻는다                                    |
| 합격 판정 | 앱이 판정하지 않는다. 응시 결과(합격·불합격·점수·등급)는 사용자가 넣는다. 앱은 목표 점수와 비교한 "목표 달성" 표시만 한다 |
| 만료 임박 | 만료일까지 90일 이하로 남으면 "만료 임박", 지나면 "만료"로 표시한다                                                       |
| 메뉴      | 대시보드 · 자격증 · 팝송 가사 · 단어장 · 설정                                                                             |

## 3. 화면

화면 주소는 `frontend/src/app.tsx`의 `pages` 한 곳에 둔다.

| 메뉴      | 주소                                              | 화면                                                             | 이슈               |
| --------- | ------------------------------------------------- | ---------------------------------------------------------------- | ------------------ |
| 대시보드  | `/`                                               | 가까운 시험(남은 날 수), 오늘 할 일, 만료 임박, 오늘의 단어 카드 | #30, #32, #33, #37 |
| 자격증    | `/certifications`                                 | 목표 목록(분류별로 묶고 목표 시험일 순)                          | #30                |
|           | `/certifications/new`, `/certifications/:id/edit` | 목표 등록·수정                                                   | #30                |
|           | `/certifications/:id`                             | 상세: 목표 정보, 응시·취득 기록, 공부 계획                       | #30, #32, #33      |
| 팝송 가사 | `/songs`                                          | 앨범별 곡 목록, 곡 검색, 번역 여부 표시                          | #35                |
|           | `/songs/:id`                                      | 원문과 번역을 줄 단위로 나란히(모바일은 위아래)                  | #35                |
| 단어장    | `/words`                                          | 빈도 순 단어 목록, 검색                                          | #36                |
|           | `/words/:id`                                      | 뜻·예문·어원 요소, 같은 어근의 단어                              | #36                |
| 설정      | `/settings`                                       | 지금 화면 유지                                                   | —                  |

삭제는 공통 삭제 확인 대화상자를 거친다. 자격증 목표를 지우면 그 응시 기록과 공부 계획도 함께 지워진다고 대화상자에 적는다.

## 4. 공통 규칙

- 키: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`. 연결 테이블은 복합 기본 키를 쓴다.
- 기록 시점: 모든 주 테이블에 `created_at`, `updated_at` (`timestamptz NOT NULL DEFAULT now()`). `updated_at`은 API가 고칠 때 바꾼다.
- 날짜: 사용자가 고르는 날(시험일, 마감일)은 `date`, API 값은 `YYYY-MM-DD`. "오늘"은 서버의 `serviceDate()`(`Asia/Seoul`)로 계산한다.
- 일이 일어난 시점(할 일 완료, 가사 받은 때, 외운 때)은 `timestamptz`.
- NULL: 모르는 값·아직 채우지 않은 값은 `NULL`, 확인했는데 실제로 없는 값은 빈 문자열 `''`. 메모처럼 "없음"과 "모름"을 나눌 필요가 없는 열만 `NOT NULL DEFAULT ''`로 둔다. 숫자·날짜처럼 `''`를 쓸 수 없는 열은 `NULL` 하나로 두고, 두 뜻을 나눠야 하면 다른 열(`outcome`, `validity_kind`)로 구분한다. 열마다 아래 표에 뜻을 적었다.
- 글자 수: 이름·제목은 `CHECK (length(btrim(col)) BETWEEN 1 AND 200)`. 메모는 제한 없음(`text NOT NULL DEFAULT ''`).
- 기간 단위: 중앙 규칙은 기간을 분 단위 `integer`로 정한다. 이 앱에는 분이 맞지 않는 기간이 둘 있어 예외로 둔다(중앙 이슈 [project-standards#353](https://github.com/sirloinbh/project-standards/issues/353)). 곡 길이 `duration_seconds`(초, LRCLIB·MusicBrainz 값이 초·밀리초)와 유효기간 `validity_months`(달력 개월, 자격증 안내가 "2년", "3년"). 둘 다 `CHECK (… > 0)`.
- 순서 열(`position`): 1부터 시작하고 `CHECK (position > 0)`.
  - 사용자가 순서를 바꾸는 `study_stages`·`study_tasks`만 `UNIQUE (…, position)`을 `DEFERRABLE INITIALLY DEFERRED`로 만든다. PostgreSQL은 지연하지 않은 UNIQUE를 행마다 바로 검사해서, 두 행의 순서를 맞바꾸는 UPDATE가 트랜잭션 안에서도 실패하기 때문이다.
  - 지연 제약은 `CREATE TABLE IF NOT EXISTS` 안에 표 제약으로 적는다. 인덱스(`CREATE UNIQUE INDEX`)로는 지연할 수 없다. `ALTER TABLE … ADD CONSTRAINT`에는 `IF NOT EXISTS`가 없으므로, 나중에 따로 붙여야 하면 `pg_constraint`를 확인하는 `DO` 블록으로 써서 다시 실행해도 안전하게 한다.
  - `album_tracks`·`word_morphemes`·`daily_words`의 키는 지연하지 않는다. `INSERT … ON CONFLICT`는 지연 제약을 충돌 판정에 쓸 수 없어서, 동시 요청 처리(`daily_words`)와 들여오기가 깨진다.
- 정해진 값 목록은 `text` + `CHECK (col IN (...))`. 값은 영문 소문자, 화면 문구는 프런트엔드에서 한국어로 바꾼다.
- 삭제: 부모에 딸린 행(응시 기록, 계획, 가사 줄)은 `ON DELETE CASCADE`. 공유되는 자료(어원 요소)는 `ON DELETE RESTRICT`.
- 마이그레이션 번호는 착수할 때 정한다. 아래 순서는 예상이다.

## 5. 자격증 영역

### `certifications` — 목표 자격증 (#30, 예상 `002`)

| 열                 | 형                                | 뜻·규칙                                                                                                                                          |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`             | `text NOT NULL`                   | 자격증 이름. 1~200자                                                                                                                             |
| `category`         | `text NOT NULL`                   | `english`(영어) · `dev`(개발) · `life`(생활)                                                                                                     |
| `issuer`           | `text NOT NULL DEFAULT ''`        | 주관 기관(예: YBM, 한국산업인력공단, AWS)                                                                                                        |
| `status`           | `text NOT NULL DEFAULT 'planned'` | `planned`(계획) · `studying`(공부 중) · `registered`(접수) · `taken`(응시 완료) · `passed`(합격) · `failed`(불합격). 사용자가 고른다             |
| `goal_text`        | `text NOT NULL DEFAULT ''`        | 목표 설명(예: "900점 이상", "Level 7", "합격")                                                                                                   |
| `target_score`     | `integer NULL`                    | 점수형 목표. 점수가 없는 자격증이거나 정하지 않았으면 `NULL`. `CHECK (target_score >= 0)`                                                        |
| `target_exam_date` | `date NULL`                       | 목표 시험일. 아직 정하지 않았으면 `NULL`                                                                                                         |
| `validity_kind`    | `text NOT NULL DEFAULT 'unknown'` | 유효기간 종류: `months`(개월 수 있음) · `none`(만료 없음) · `unknown`(모름)                                                                      |
| `validity_months`  | `integer NULL`                    | `validity_kind = 'months'`일 때만 값이 있다. `CHECK ((validity_kind = 'months') = (validity_months IS NOT NULL))`, `CHECK (validity_months > 0)` |
| `memo`             | `text NOT NULL DEFAULT ''`        | 메모                                                                                                                                             |

- 정렬: 목록은 `category`로 묶고, `target_exam_date`가 가까운 순, `NULL`은 뒤로.
- 첫 목표 6개(#30): 토익, 토익 스피킹, 정보처리기사, AWS Cloud Practitioner, AWS Solutions Architect – Associate, 운전면허. 개인 데이터라 마이그레이션 시드로 넣지 않고 화면에서 등록한다.

### `exam_attempts` — 응시·취득 기록 (#32, `003`)

| 열                 | 형                                | 뜻·규칙                                                                                                   |
| ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `certification_id` | `bigint NOT NULL`                 | `certifications(id) ON DELETE CASCADE`                                                                    |
| `exam_date`        | `date NOT NULL`                   | 시험일                                                                                                    |
| `outcome`          | `text NOT NULL DEFAULT 'waiting'` | `waiting`(결과 전) · `passed`(합격) · `failed`(불합격) · `scored`(점수·등급만 있는 시험). 사용자가 넣는다 |
| `score`            | `integer NULL`                    | 점수. 점수가 없는 시험이거나 결과 전이면 `NULL`. `CHECK (score >= 0)`                                     |
| `grade`            | `text NULL`                       | 등급(예: "Level 7", "IH"). 등급이 없는 시험이면 `''`, 결과 전이면 `NULL`                                  |
| `expires_on`       | `date NULL`                       | 마지막 유효일(그날까지 유효). `NULL`의 뜻은 목표의 `validity_kind`와 `outcome`으로 나눈다(아래 표시 규칙) |
| `memo`             | `text NOT NULL DEFAULT ''`        | 메모                                                                                                      |

- 만료일 기본값: 결과를 `passed`나 `scored`로 넣을 때, 목표의 `validity_kind`가 `months`면 `exam_date`에 `validity_months`개월을 더해 채운다. 사용자가 고칠 수 있다.
  - 개월 더하기는 PostgreSQL `date + interval`과 같은 말일 보정을 쓴다. 예: `2024-02-29` + 24개월 = `2026-02-28`. JavaScript `setUTCMonth`는 `2026-03-01`로 넘치므로 그대로 쓰지 않는다.
  - 토익·토익 스피킹(2년)과 AWS(3년)는 시험일부터 센다. 마지막 유효일은 "더한 날"이다. 토익은 "시험 시행일로부터 2년 뒤 해당 시험 일자까지"로 확인했고, AWS는 날짜 단위 안내가 없어 같은 계산을 쓴다. 근거는 [#32 변경 기록](../changes/32-exam-attempts-expiry.md).
  - 운전면허는 `validity_kind = 'months'`로 두고 갱신 주기를 넣는다. `expires_on`은 갱신 기한이다. 시험일에서 계산한 값은 참고값이므로 실제 기한을 확인해 고친다.
- 만료일은 시험일 이후여야 한다(표 제약 `exam_attempts_expires_after_exam`). 결과가 `waiting`·`failed`인 기록은 API가 `expires_on`을 `NULL`로 저장한다. `waiting`에는 점수·등급을 받지 않는다.
- `validity_kind`가 `none`인 목표의 기록은 API가 `expires_on`을 `NULL`로 저장한다. 목표를 `none`으로 바꾸면 그 기록들의 `expires_on`도 같은 트랜잭션에서 비운다.
- 한 자격증에 기록이 여러 개면(재응시) 대시보드의 만료 카드는 `passed`·`scored` 기록 중 시험일이 가장 늦은 것 하나만 쓴다. 상세 화면의 이전 기록에는 만료 상태 대신 "새 기록 있음"을 보여 준다.
- 만료 상태(저장하지 않고 계산, 위에서부터 먼저 맞는 것):

| 조건                                                                | 표시          |
| ------------------------------------------------------------------- | ------------- |
| `outcome`이 `waiting`이나 `failed`                                  | 표시 안 함    |
| 목표의 `validity_kind`가 `none`                                     | "만료 없음"   |
| `expires_on`이 `NULL` (`validity_kind`가 `unknown`이거나 값을 지움) | "만료일 모름" |
| 오늘 > `expires_on`                                                 | "만료"        |
| `expires_on` − 오늘 ≤ 90일                                          | "만료 임박"   |
| 그 밖                                                               | "유효"        |

- 목표 달성(저장하지 않고 계산): `score >= target_score`이면 "목표 달성". `target_score`가 `NULL`이면 표시하지 않는다.
- 결과를 `passed`로 저장하면 화면이 "목표 상태를 합격으로 바꿀까요?"를 묻는다. 같은 요청에서 바꾸지 않고, 사용자가 고르면 목표 수정 API를 따로 부른다.

### `study_stages`, `study_tasks` — 공부 계획 (#33, `004`)

`study_stages`

| 열                       | 형                 | 뜻·규칙                                                                       |
| ------------------------ | ------------------ | ----------------------------------------------------------------------------- |
| `certification_id`       | `bigint NOT NULL`  | `certifications(id) ON DELETE CASCADE`                                        |
| `title`                  | `text NOT NULL`    | 단계 이름(예: "1주차", "기출 풀이"). 1~200자                                  |
| `position`               | `integer NOT NULL` | 화면 순서. 같은 자격증 안에서 지연 UNIQUE `(certification_id, position)`(4절) |
| `start_date`, `end_date` | `date NULL`        | 단계 기간. 정하지 않았으면 `NULL`. 둘 다 있으면 `start_date <= end_date`      |

`study_tasks`

| 열             | 형                 | 뜻·규칙                                 |
| -------------- | ------------------ | --------------------------------------- |
| `stage_id`     | `bigint NOT NULL`  | `study_stages(id) ON DELETE CASCADE`    |
| `title`        | `text NOT NULL`    | 할 일. 1~200자                          |
| `position`     | `integer NOT NULL` | 지연 UNIQUE `(stage_id, position)`(4절) |
| `due_date`     | `date NULL`        | 마감일. 없으면 `NULL`                   |
| `completed_at` | `timestamptz NULL` | 완료한 시점. 아직이면 `NULL`            |

- 진행률(계산): 완료한 할 일 수 ÷ 전체 할 일 수. 할 일이 없으면 표시하지 않는다.
- 오늘 할 일(계산): `completed_at IS NULL`이고 `due_date <= 오늘`인 할 일. 지난 것은 "지남"으로 표시한다.
- 새 단계와 할 일은 맨 뒤에 붙는다. 순서 바꾸기 화면은 아직 없다(#33 변경 기록).
- 순서 바꾸기는 여러 행을 고치므로 한 트랜잭션으로 처리한다. UNIQUE를 지연 제약으로 만들어 커밋할 때 한 번만 검사한다(4절).

## 6. 영어 공부 영역

### 곡과 가사 (#35, 예상 `005`)

가사 원문과 번역은 로컬 DB에만 저장한다([자료 출처](../research/english-content-sources.md) 1절).

| 테이블         | 열                                                                                                                                                                                                                                    | 뜻·규칙                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artists`      | `name text NOT NULL`, `musicbrainz_id uuid NULL UNIQUE`                                                                                                                                                                               | 아티스트. 처음에는 테일러 스위프트 한 명                                                                                                                                                                    |
| `albums`       | `artist_id`(`RESTRICT`), `title`, `kind`, `release_date date NULL`, `musicbrainz_id uuid NULL UNIQUE`                                                                                                                                 | `kind`: `studio`(정규) · `taylors_version`. 발매일을 모르면 `NULL`                                                                                                                                          |
| `songs`        | `artist_id`(`RESTRICT`), `title`, `duration_seconds integer NULL`, `musicbrainz_id uuid NULL UNIQUE`, `lyrics_source text NULL`, `lyrics_source_url text NULL`, `lyrics_fetched_at timestamptz NULL`, `note text NOT NULL DEFAULT ''` | `lyrics_source`: `lrclib` · `manual`. 가사가 아직 없으면 `NULL`. `lyrics_source_url`은 LRCLIB에서 받았으면 그 주소, 직접 넣었으면 `''`, 가사가 아직 없으면 `NULL`. `note`에 재녹음 때 바뀐 가사 등을 적는다 |
| `album_tracks` | `album_id`(`CASCADE`), `song_id`(`CASCADE`), `track_number integer NOT NULL`                                                                                                                                                          | 기본 키 `(album_id, track_number)`, `UNIQUE (album_id, song_id)`. 같은 곡이 여러 앨범에 실린다                                                                                                              |
| `lyric_lines`  | `song_id`(`CASCADE`), `line_number integer NOT NULL`, `original text NOT NULL`, `translation text NULL`                                                                                                                               | 기본 키 `(song_id, line_number)`. 빈 줄(절 구분)은 `original = ''`. 아직 번역하지 않았으면 `translation`이 `NULL`                                                                                           |

- 가사 상태(계산), 위에서부터 먼저 맞는 것:
  - "가사 없음": `original <> ''`인 줄이 하나도 없다(`lyrics_source`가 `NULL`인 곡 포함).
  - "번역 전": `original <> ''`인 줄 중 `translation`이 `NULL`인 줄이 있다.
  - "번역 있음": 그 밖. 곡 목록과 번역 진행 상황은 이 값으로 보여 준다.
- 번역 들여오기는 한 곡의 모든 줄을 한 트랜잭션으로 고친다. 줄 수가 다르면 아무것도 저장하지 않는다.

### 단어와 어원 (#36, 예상 `006`)

| 테이블           | 열                                                                                                                                                                                                                                                                                                                                                               | 뜻·규칙                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `words`          | `lemma text NOT NULL UNIQUE`, `frequency_rank integer NOT NULL UNIQUE`, `part_of_speech text NULL`, `meaning_ko text NULL`, `example_en text NULL`, `example_ko text NULL`, `ai_generated boolean NOT NULL DEFAULT false`, `list_source_id`(`RESTRICT`), `etymology_source text NULL`, `etymology_url text NULL`, `etymology_source_id`(`RESTRICT`, `NULL` 허용) | `frequency_rank`는 NGSL 1.2 순위(1부터). 품사·뜻·예문을 아직 채우지 않았으면 `NULL`. `etymology_source`는 Wiktionary 어원 원문이다. 아직 찾아보지 않았으면 `NULL`, 찾아봤는데 자료가 없으면 `''`. `etymology_url`(Wiktionary 항목 주소)도 같은 규칙이다. `etymology_source_id`는 찾아본 때의 받은 기록이고, 아직 찾아보지 않았으면 `NULL`(자료가 없었어도 찾아봤으면 값이 있다). `list_source_id`는 단어 목록(NGSL)을 받은 기록                                                                |
| `morphemes`      | `key text NOT NULL UNIQUE`, `form text NOT NULL`, `kind text NOT NULL`, `meaning_ko text NOT NULL`, `origin text NULL`                                                                                                                                                                                                                                           | 어원 요소. `kind`: `prefix` · `root` · `suffix`. `key`는 같은 요소를 찾는 고정 이름이다. 먼저 만든 요소는 `<kind>:<form>`(예: `root:port`, 나르다). 나중에 철자는 같고 뜻이 다른 요소가 나오면 그 요소에만 `:<영문 뜻>`을 붙인다(예: `root:port:harbor`, 항구). 한 번 정한 `key`는 바꾸지 않는다. 형식은 `CHECK`로 막는다: `key = kind \|\| ':' \|\| form` 또는 `key LIKE kind \|\| ':' \|\| form \|\| ':%'`. `form`은 소문자이고 하이픈을 붙이지 않는다. `origin` 예: "라틴어", 모르면 `NULL` |
| `word_morphemes` | `word_id`(`CASCADE`), `morpheme_id`(`RESTRICT`), `position integer NOT NULL`                                                                                                                                                                                                                                                                                     | 기본 키 `(word_id, position)`. 단어 안에서 요소의 순서                                                                                                                                                                                                                                                                                                                                                                                                                                         |

- 같은 어근의 단어: `word_morphemes`에서 같은 `morpheme_id`를 가진 다른 단어.
- 어원 들여오기는 요소를 `key`로 찾아 이미 있으면 그 행을 쓴다. 내보내기 파일에 지금 있는 요소 목록(`key`, `meaning_ko`)을 함께 넣어, Claude Code 세션이 같은 요소에 새 이름을 만들지 않게 한다. 뜻 문장이 조금 달라도 `key`가 같으면 같은 요소다.
- 출처 표기: 단어장 화면 아래에 `import_sources`의 자료 이름(`kind`를 화면에서 "NGSL 1.2", "Wiktionary"로 바꿔 보여 줌)과 라이선스(NGSL은 CC BY-SA 4.0, Wiktionary는 받을 때 확인한 버전)를 적는다.

### `import_sources` — 외부 자료를 받은 기록 (#35·#36 중 먼저 하는 이슈에서)

[자료 출처](../research/english-content-sources.md) 6절의 "출처 URL과 받은 날짜를 함께 저장"을 위한 테이블이다. 가져오기 스크립트를 한 번 실행할 때마다 한 행을 남긴다. 곡별 LRCLIB 주소와 받은 때는 `songs`에 두므로, `musicbrainz`·`lrclib` 행은 다른 테이블이 참조하지 않고 실행 이력과 라이선스 확인용으로만 남는다. 단어 쪽은 `words`가 참조한다.

| 열           | 형                     | 뜻·규칙                                                                                        |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `kind`       | `text NOT NULL`        | `musicbrainz` · `lrclib` · `ngsl` · `wiktionary`                                               |
| `url`        | `text NOT NULL`        | 받은 주소(파일이나 API 기본 주소)                                                              |
| `license`    | `text NULL`            | 받을 때 확인한 라이선스 표기(예: `CC BY-SA 4.0`). 표기가 없으면 `''`, 확인하지 않았으면 `NULL` |
| `fetched_at` | `timestamptz NOT NULL` | 받은 시점                                                                                      |

### 오늘의 단어 (#37, 예상 `007`)

| 테이블            | 열                                                                     | 뜻·규칙                                                                                                     |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `daily_words`     | `day date NOT NULL`, `position integer NOT NULL`, `word_id`(`CASCADE`) | 기본 키 `(day, position)`, `UNIQUE (day, word_id)`. 그날 처음 열 때 정하고, 다시 열면 같은 단어를 보여 준다 |
| `words`에 열 추가 | `learned_at timestamptz NULL`                                          | "외웠어요"를 누른 시점. 아직이면 `NULL`. 외운 단어는 다시 뽑지 않는다                                       |

- 하루 단어 수와 고르는 규칙은 #37에서 사용자에게 확인한다. 같은 날 두 요청이 동시에 와도 한 번만 정해지도록 `INSERT … ON CONFLICT DO NOTHING` 뒤 다시 읽는다.

## 7. 관계 한눈에 보기

```
certifications 1─* exam_attempts
certifications 1─* study_stages 1─* study_tasks

artists 1─* albums 1─* album_tracks *─1 songs 1─* lyric_lines
artists 1─* songs

words 1─* word_morphemes *─1 morphemes
words 1─* daily_words
import_sources 1─* words (단어 목록, 어원)
```
