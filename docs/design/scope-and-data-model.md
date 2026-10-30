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
- NULL: 모르는 값·아직 없는 값은 `NULL`, 실제로 없는 값(빈 메모)은 빈 문자열 `''`. 열마다 아래 표에 뜻을 적었다.
- 글자 수: 이름·제목은 `CHECK (length(btrim(col)) BETWEEN 1 AND 200)`. 메모는 제한 없음(`text NOT NULL DEFAULT ''`).
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

### `exam_attempts` — 응시·취득 기록 (#32, 예상 `003`)

| 열                 | 형                                | 뜻·규칙                                                                                                   |
| ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `certification_id` | `bigint NOT NULL`                 | `certifications(id) ON DELETE CASCADE`                                                                    |
| `exam_date`        | `date NOT NULL`                   | 시험일                                                                                                    |
| `outcome`          | `text NOT NULL DEFAULT 'waiting'` | `waiting`(결과 전) · `passed`(합격) · `failed`(불합격) · `scored`(점수·등급만 있는 시험). 사용자가 넣는다 |
| `score`            | `integer NULL`                    | 점수. 점수가 없는 시험이거나 결과 전이면 `NULL`. `CHECK (score >= 0)`                                     |
| `grade`            | `text NOT NULL DEFAULT ''`        | 등급(예: "Level 7", "IH"). 없으면 `''`                                                                    |
| `expires_on`       | `date NULL`                       | 만료일. 만료가 없거나 아직 결과 전이면 `NULL`                                                             |
| `memo`             | `text NOT NULL DEFAULT ''`        | 메모                                                                                                      |

- 만료일 기본값: 결과를 `passed`나 `scored`로 넣을 때, 목표의 `validity_kind`가 `months`면 `exam_date + validity_months`로 채운다. 사용자가 고칠 수 있다. 토익·토익 스피킹(2년)과 AWS(3년)는 시험일부터 센다. 구현 전에 공식 안내로 다시 확인한다.
- 만료 상태(저장하지 않고 계산): 오늘 > `expires_on`이면 "만료", 남은 날이 90일 이하면 "만료 임박", 그 밖은 "유효". `expires_on`이 `NULL`이면 표시하지 않는다.
- 목표 달성(저장하지 않고 계산): `score >= target_score`이면 "목표 달성". `target_score`가 `NULL`이면 표시하지 않는다.
- 결과를 `passed`로 저장하면 화면이 "목표 상태를 합격으로 바꿀까요?"를 묻는다. 같은 요청에서 바꾸지 않고, 사용자가 고르면 목표 수정 API를 따로 부른다.

### `study_stages`, `study_tasks` — 공부 계획 (#33, 예상 `004`)

`study_stages`

| 열                       | 형                 | 뜻·규칙                                                                  |
| ------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `certification_id`       | `bigint NOT NULL`  | `certifications(id) ON DELETE CASCADE`                                   |
| `title`                  | `text NOT NULL`    | 단계 이름(예: "1주차", "기출 풀이"). 1~200자                             |
| `position`               | `integer NOT NULL` | 화면 순서. 같은 자격증 안에서 `UNIQUE (certification_id, position)`      |
| `start_date`, `end_date` | `date NULL`        | 단계 기간. 정하지 않았으면 `NULL`. 둘 다 있으면 `start_date <= end_date` |

`study_tasks`

| 열             | 형                 | 뜻·규칙                              |
| -------------- | ------------------ | ------------------------------------ |
| `stage_id`     | `bigint NOT NULL`  | `study_stages(id) ON DELETE CASCADE` |
| `title`        | `text NOT NULL`    | 할 일. 1~200자                       |
| `position`     | `integer NOT NULL` | `UNIQUE (stage_id, position)`        |
| `due_date`     | `date NULL`        | 마감일. 없으면 `NULL`                |
| `completed_at` | `timestamptz NULL` | 완료한 시점. 아직이면 `NULL`         |

- 진행률(계산): 완료한 할 일 수 ÷ 전체 할 일 수. 할 일이 없으면 표시하지 않는다.
- 오늘 할 일(계산): `completed_at IS NULL`이고 `due_date <= 오늘`인 할 일. 지난 것은 "지남"으로 표시한다.
- 순서 바꾸기는 여러 행을 고치므로 한 트랜잭션으로 처리한다.

## 6. 영어 공부 영역

### 곡과 가사 (#35, 예상 `005`)

가사 원문과 번역은 로컬 DB에만 저장한다([자료 출처](../research/english-content-sources.md) 1절).

| 테이블         | 열                                                                                                                                                                                                     | 뜻·규칙                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `artists`      | `name text NOT NULL`, `musicbrainz_id uuid NULL UNIQUE`                                                                                                                                                | 아티스트. 처음에는 테일러 스위프트 한 명                                                                          |
| `albums`       | `artist_id`(`RESTRICT`), `title`, `kind`, `release_date date NULL`, `musicbrainz_id uuid NULL UNIQUE`                                                                                                  | `kind`: `studio`(정규) · `taylors_version`. 발매일을 모르면 `NULL`                                                |
| `songs`        | `artist_id`(`RESTRICT`), `title`, `duration_seconds integer NULL`, `musicbrainz_id uuid NULL UNIQUE`, `lyrics_source text NULL`, `lyrics_fetched_at timestamptz NULL`, `note text NOT NULL DEFAULT ''` | `lyrics_source`: `lrclib` · `manual`. 가사가 아직 없으면 `NULL`. `note`에 재녹음 때 바뀐 가사 등을 적는다         |
| `album_tracks` | `album_id`(`CASCADE`), `song_id`(`CASCADE`), `track_number integer NOT NULL`                                                                                                                           | 기본 키 `(album_id, track_number)`, `UNIQUE (album_id, song_id)`. 같은 곡이 여러 앨범에 실린다                    |
| `lyric_lines`  | `song_id`(`CASCADE`), `line_number integer NOT NULL`, `original text NOT NULL`, `translation text NULL`                                                                                                | 기본 키 `(song_id, line_number)`. 빈 줄(절 구분)은 `original = ''`. 아직 번역하지 않았으면 `translation`이 `NULL` |

- "번역 있음"(계산): 곡의 모든 줄 중 `original <> ''`인 줄의 `translation`이 `NULL`이 아니다.
- 번역 들여오기는 한 곡의 모든 줄을 한 트랜잭션으로 고친다. 줄 수가 다르면 아무것도 저장하지 않는다.

### 단어와 어원 (#36, 예상 `006`)

| 테이블           | 열                                                                                                                                                                                                                                                                                                | 뜻·규칙                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `words`          | `lemma text NOT NULL UNIQUE`, `frequency_rank integer NOT NULL UNIQUE`, `part_of_speech text NOT NULL DEFAULT ''`, `meaning_ko text NULL`, `example_en text NULL`, `example_ko text NULL`, `etymology_source text NULL`, `etymology_url text NULL`, `ai_generated boolean NOT NULL DEFAULT false` | `frequency_rank`는 NGSL 1.2 순위(1부터). 뜻·예문·어원을 아직 채우지 않았으면 `NULL`. `etymology_source`는 Wiktionary 어원 원문이고, 자료가 없으면 `NULL` |
| `morphemes`      | `form text NOT NULL`, `kind text NOT NULL`, `meaning_ko text NOT NULL`, `origin text NOT NULL DEFAULT ''`                                                                                                                                                                                         | 어원 요소. `kind`: `prefix` · `root` · `suffix`. `UNIQUE (form, kind, meaning_ko)`. `origin` 예: "라틴어"                                                |
| `word_morphemes` | `word_id`(`CASCADE`), `morpheme_id`(`RESTRICT`), `position integer NOT NULL`                                                                                                                                                                                                                      | 기본 키 `(word_id, position)`. 단어 안에서 요소의 순서                                                                                                   |

- 같은 어근의 단어: `word_morphemes`에서 같은 `morpheme_id`를 가진 다른 단어.
- 출처 표기: 단어장 화면 아래에 NGSL(CC BY-SA 4.0)과 Wiktionary(CC BY-SA)를 적는다.

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
```
