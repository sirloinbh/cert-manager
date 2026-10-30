# 영어 공부 자료 출처와 가져오기 방법

- 이슈: [#31](https://github.com/sirloinbh/cert-manager/issues/31)
- 조사일: 2026-10-30 (Asia/Seoul). 아래 숫자(요청 제한, 단어 수 등)는 이날 공식 문서에서 확인한 값이고, 바뀔 수 있다.
- 이 문서를 따르는 기능 이슈: [#35](https://github.com/sirloinbh/cert-manager/issues/35) 팝송 가사 보기, [#36](https://github.com/sirloinbh/cert-manager/issues/36) 단어장과 어원, [#37](https://github.com/sirloinbh/cert-manager/issues/37) 오늘의 단어

## 결론

| 대상           | 정한 방법                                                                                                     | 상태             |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| 가사 원문      | 유튜브 뮤직은 쓰지 않는다. LRCLIB API에서 곡마다 한 번 받아 로컬 DB에 저장하고, 없는 곡은 직접 붙여 넣는다    | 사용자 확인 대기 |
| 가사 번역      | 백엔드 가져오기 스크립트가 Claude API로 곡마다 한 번 번역해 DB에 저장한다. 화면을 열 때는 API를 부르지 않는다 | 사용자 확인 대기 |
| 곡 목록        | MusicBrainz API에서 앨범·수록곡 목록을 받는다                                                                 | 추천             |
| "전곡" 범위    | 정규 앨범 12장의 기본 수록곡과 Taylor's Version 4장의 From the Vault 곡부터 시작한다                          | 사용자 확인 대기 |
| 자주 쓰는 단어 | NGSL 1.2(2,809단어)를 공식 사이트에서 받아 쓴다                                                               | 추천             |
| 어원           | Wiktionary 어원 글(kaikki.org 추출본)을 근거로, Claude가 접두사·어근·접미사로 나누고 한국어로 설명한다        | 추천             |
| 저장 위치      | 가사 원문·번역은 로컬 DB에만 둔다. 리포에는 커밋하지 않는다                                                   | 필수 규칙        |

## 1. 가사 원문

### 유튜브 뮤직: 쓰지 않는다

- 유튜브 뮤직에는 가사를 주는 공식 API가 없다.
- 비공식 라이브러리 `ytmusicapi`(Python)에 `get_lyrics()`가 있다. 하지만 이 라이브러리는 웹 브라우저 요청을 흉내 내는 방식이다.
- YouTube 서비스 약관은 "자동화된 수단(로봇, 봇넷 또는 스크래퍼 등)을 사용해 서비스에 액세스"하는 것을 금지한다. 예외는 robots.txt를 따르는 공개 검색엔진과 YouTube의 사전 서면 승인뿐이다.
- 이 프로젝트는 Node.js라서 Python 도구를 새로 들여와야 한다.
- 그래서 사용자 요구사항의 "안 되면" 경로로 간다.

### LRCLIB: 추천

[LRCLIB](https://lrclib.net/docs)는 무료로 공개된 가사 데이터베이스다.

- API 키가 필요 없다.
- `GET /api/get?track_name=&artist_name=&album_name=&duration=`으로 곡 하나의 가사를 찾는다. 시간 정보가 붙은 가사(`syncedLyrics`)와 일반 가사(`plainLyrics`)를 준다.
- 요청 제한은 IP당 약 45회/분이다. 앱 이름과 연락처가 든 `User-Agent`를 보내면 약 90회/분이다. `429` 응답이면 `Retry-After`만큼 기다려야 하고, 요청 사이에 200~500ms를 두라고 권한다.
- 문서에 가사 데이터의 라이선스 표기가 없다. 가사의 저작권은 원저작자에게 있다고 보고, 개인이 로컬에서만 보는 용도로 쓴다.
- 못 찾은 곡은 사용자가 화면에서 직접 붙여 넣을 수 있게 한다.

### 저작권과 저장 규칙

- 가사 원문과 그 번역은 저작물이다. 이 리포는 공개 리포라서 가사·번역을 커밋하면 공개 배포가 된다.
- 가사·번역은 로컬 DB에만 저장한다. 백업 파일은 `backups/`에 생기고 `.gitignore`에 들어 있다.
- 테스트에는 직접 지은 짧은 문장만 쓴다.
- 앱을 외부에 공개하기 전에는 가사 화면을 사설 접속이나 인증 뒤에 둔다(#25 서비스 범위의 공개 전 조건).

## 2. 가사 번역

| 방식                                        | 장점                                                    | 단점                                                          |
| ------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 화면을 열 때마다 Claude API 호출            | 바로 볼 수 있음                                         | 같은 곡을 여러 번 번역해 비용이 계속 나감. 응답을 기다려야 함 |
| **가져올 때 한 번 번역해 DB에 저장 (추천)** | 비용이 곡 수만큼만 듦. 화면이 빠름. 번역을 고칠 수 있음 | API 키 설정이 필요함                                          |
| Claude Code 세션에서 번역해 넣기            | API 키가 필요 없음                                      | 곡이 많으면 손이 많이 감. 다시 하기 어려움                    |

추천 방식의 구성:

- 백엔드에 가져오기 스크립트를 둔다. 줄 번호를 붙인 원문을 보내고 같은 줄 수의 번역을 받아 줄 단위로 저장한다.
- 키와 모델은 중앙 규칙(project-standards `docs/env-conventions.md`)의 `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`을 쓴다. 키는 백엔드에서만 쓰고 프런트엔드로 넘기지 않는다.
- 이 앱은 중앙 레지스트리의 `features.claude`가 꺼져 있다. 켜는 일은 중앙 이슈로 등록했고, 키 발급은 이미 있는 중앙 사용자 단계를 따른다(아래 "이어지는 이슈").
- 모델과 예상 비용은 구현 이슈에서 곡 수가 정해진 뒤 계산한다.

## 3. 곡 목록과 "전곡" 범위

### 곡 목록 출처: MusicBrainz

- [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) API에서 아티스트 → 앨범(release group) → 수록곡 목록을 받는다.
- 핵심 데이터(아티스트, 앨범, 곡 이름)는 CC0(퍼블릭 도메인)이라 곡 목록은 마음껏 저장해도 된다.
- 요청 제한은 IP당 평균 1회/초이고, 앱을 알아볼 수 있는 `User-Agent`가 필요하다.

### 범위 추천

테일러 스위프트의 정규 앨범은 12장이다(2026-10 기준). 마지막은 2025-10-03에 나온 *The Life of a Showgirl*이다.

1. 정규 앨범 12장의 기본판 수록곡: _Taylor Swift_, _Fearless_, _Speak Now_, _Red_, _1989_, _reputation_, _Lover_, _folklore_, _evermore_, _Midnights_, _The Tortured Poets Department_, _The Life of a Showgirl_
2. Taylor's Version 4장(_Fearless_, _Red_, _Speak Now_, _1989_)의 From the Vault 곡만. 다시 녹음한 곡은 가사가 원곡과 같아 중복이다.
3. 디럭스판 보너스 곡, 싱글·OST 곡은 2단계로 미룬다.

같은 곡이 여러 앨범에 있으면 곡 하나로 저장하고 수록 앨범을 여러 개 연결한다.

## 4. 자주 쓰는 단어

[NGSL(New General Service List) 1.2](https://www.newgeneralservicelist.com/new-general-service-list)를 쓴다.

- 영어 학습자를 위한 일반·일상 영어 핵심 단어 2,809개다.
- 라이선스는 CC BY-SA 4.0이다. 출처(Browne, Culligan, Phillips)를 표기해야 하고, 고친 목록을 배포하면 같은 라이선스를 따라야 한다.
- 공식 사이트는 `newgeneralservicelist.com` 하나뿐이라고 밝힌다. 그곳에서만 받는다.
- 빈도 통계가 있는 버전을 받아 빈도 순위를 저장한다.
- 한국어 뜻과 예문은 Claude로 만들어 저장하고, AI가 만든 값이라고 표시한다.

## 5. 어원

- 근거 자료는 Wiktionary의 영어 어원 글이다. [kaikki.org](https://kaikki.org/)가 Wiktionary 덤프에서 뽑은 JSON 자료(wiktextract)를 받는다.
- Wiktionary 글의 라이선스는 CC BY-SA다. 자료마다 3.0과 4.0 표기가 섞여 있어, 받을 때 kaikki.org의 표기를 기록한다.
- Wiktionary 어원은 문장이라 접두사·어근·접미사로 나뉘어 있지 않다. Claude가 어원 글을 근거로 요소를 나누고 한국어로 설명한다. 근거 글이 없는 단어는 "어원 자료 없음"으로 두고 지어내지 않는다.
- 화면에 출처(Wiktionary 링크)와 AI 정리 여부를 함께 보여 준다.

## 6. 공통 규칙

- 외부 자료를 받는 스크립트는 받은 원본을 리포 밖(로컬 DB나 `.local/`)에 둔다. 출처 URL과 받은 날짜를 함께 저장한다.
- 공개 리포에 넣어도 되는 것은 곡 목록(CC0)과 스크립트 코드뿐이다. NGSL·Wiktionary 자료를 리포에 넣으려면 CC BY-SA 표기를 함께 넣어야 하므로, 처음에는 넣지 않는다.

## 이어지는 이슈

- [sirloinbh/project-standards#351](https://github.com/sirloinbh/project-standards/issues/351) cert-manager 레지스트리에 Claude 기능 켜기
- [sirloinbh/project-standards#266](https://github.com/sirloinbh/project-standards/issues/266) [직접] Claude API 키 발급·지출 한도 설정하고 중앙 보관 위치에 넣기(이미 있는 사용자 단계). 로컬 개발은 앱 `.env`가 아니라 `project-standards/.env`에서 키를 읽으므로, 이 앱용 키 이슈는 따로 만들지 않았다.

## 출처

- [ytmusicapi 문서](https://ytmusicapi.readthedocs.io/en/stable/)
- [YouTube 서비스 약관](https://www.youtube.com/static?template=terms)
- [LRCLIB API 문서](https://lrclib.net/docs)
- [MusicBrainz API 요청 제한](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [NGSL 1.2](https://www.newgeneralservicelist.com/new-general-service-list)
- [kaikki.org](https://kaikki.org/)
- project-standards `docs/env-conventions.md` Claude API 키 절
