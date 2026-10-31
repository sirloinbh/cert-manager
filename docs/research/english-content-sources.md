# 영어 공부 자료 출처와 가져오기 방법

- 이슈: [#31](https://github.com/sirloinbh/cert-manager/issues/31)
- 조사일: 2026-10-30 (Asia/Seoul). 아래 숫자(요청 제한, 단어 수 등)는 이날 공식 문서에서 확인한 값이고, 바뀔 수 있다.
- 이 문서를 따르는 기능 이슈: [#35](https://github.com/sirloinbh/cert-manager/issues/35) 팝송 가사 보기, [#36](https://github.com/sirloinbh/cert-manager/issues/36) 단어장과 어원, [#37](https://github.com/sirloinbh/cert-manager/issues/37) 오늘의 단어

## 결론

가사 출처, 번역 방식, 곡 범위는 사용자가 2026-10-30에 정했다(#31 댓글).

| 대상           | 정한 방법                                                                                                          | 결정         |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------ |
| 가사 원문      | 유튜브 뮤직은 쓰지 않는다. LRCLIB API에서 곡마다 한 번 받아 로컬 DB에 저장하고, 없는 곡은 직접 붙여 넣는다         | 사용자 결정  |
| 가사 번역      | 사용자가 화면에 붙여 넣거나 번역 파일을 들여온다. 앱은 Claude API를 부르지 않는다                                  | #35에서 변경 |
| "전곡" 범위    | 정규 앨범 12장의 기본 수록곡과 Taylor's Version 4장의 From the Vault 곡부터 시작한다                               | 사용자 결정  |
| 곡 목록        | MusicBrainz API에서 앨범·수록곡 목록을 받는다                                                                      | 추천         |
| 자주 쓰는 단어 | NGSL 1.2(2,809단어)를 공식 사이트에서 받아 쓴다                                                                    | 추천         |
| 어원           | Wiktionary 어원 글(kaikki.org 추출본)을 근거로, Claude Code 세션에서 접두사·어근·접미사로 나누고 한국어로 설명한다 | 추천         |
| 저장 위치      | 가사 원문·번역은 로컬 DB와 `.local/`에만 둔다. 리포에는 커밋하지 않는다                                            | 필수 규칙    |

## 1. 가사 원문

### 유튜브 뮤직: 쓰지 않는다

- 유튜브 뮤직에는 가사를 주는 공식 API가 없다.
- 비공식 라이브러리 `ytmusicapi`(Python)에 `get_lyrics()`가 있다. 하지만 이 라이브러리는 웹 브라우저 요청을 흉내 내는 방식이다.
- YouTube 서비스 약관은 "자동화된 수단(로봇, 봇넷 또는 스크래퍼 등)을 사용해 서비스에 액세스"하는 것을 금지한다. 예외는 robots.txt를 따르는 공개 검색엔진과 YouTube의 사전 서면 승인뿐이다.
- 이 프로젝트는 Node.js라서 Python 도구를 새로 들여와야 한다.
- 그래서 사용자 요구사항의 "안 되면" 경로로 간다.

### 다른 가사 출처 비교

| 출처                       | 가사 전문                                | API 키      | 이용 조건·제한                                                   | 판단                      |
| -------------------------- | ---------------------------------------- | ----------- | ---------------------------------------------------------------- | ------------------------- |
| 유튜브 뮤직 (`ytmusicapi`) | 받을 수 있음                             | 로그인 쿠키 | 비공식 방식이고 YouTube 약관이 자동화된 접근을 금지              | 쓰지 않음                 |
| Genius API                 | 주지 않음. 곡 정보와 웹 페이지 주소만 줌 | 필요        | 가사를 얻으려면 웹 페이지를 긁어야 함                            | 쓰지 않음                 |
| Musixmatch API             | 무료 등급은 가사의 약 30%만 줌           | 필요        | 전문은 상업 계약이 필요(가격 비공개)                             | 쓰지 않음                 |
| **LRCLIB**                 | 받을 수 있음(일반·시간 정보 가사)        | 필요 없음   | 무료 공개 서비스. 요청 제한을 지켜야 함. 가사 라이선스 표기 없음 | **사용**                  |
| 직접 붙여 넣기             | 사용자가 넣음                            | 없음        | 외부 서비스 없음. 곡이 많으면 손이 많이 감                       | LRCLIB에 없는 곡에만 사용 |

Genius·Musixmatch의 제한은 공식 약관이 아니라 개발자 글과 API 목록 사이트에서 확인한 내용이다. 둘 다 쓰지 않으므로 더 확인하지 않았다.

### LRCLIB

[LRCLIB](https://lrclib.net/docs)는 무료로 공개된 가사 데이터베이스다.

- API 키가 필요 없다.
- `GET /api/get`으로 곡 하나의 가사를 찾는다. 시간 정보가 붙은 가사(`syncedLyrics`)와 일반 가사(`plainLyrics`)를 준다.
  - 필수 값: `track_name`, `artist_name`
  - 선택 값: `album_name`, `duration`(초, 1~3600). 일치 정확도를 높이므로 MusicBrainz에서 받은 값으로 채운다.
  - 못 찾으면 `404`를 준다.
- 요청 제한은 IP당 약 45회/분이다. 앱 이름과 연락처가 든 `User-Agent`를 보내면 약 90회/분이다.
- 요청은 하나씩 보내고, 요청 사이에 200~500ms를 둔다. `429` 응답이면 `Retry-After`만큼 기다린다.
- 문서에 가사 데이터의 라이선스 표기가 없다. 가사의 저작권은 원저작자에게 있다고 본다.
- 못 찾은 곡은 사용자가 화면에서 직접 붙여 넣을 수 있게 한다.

### 저작권과 저장 규칙

아래는 법적으로 허용된다는 판단이 아니라, 위험을 줄이려고 이 프로젝트가 지키는 운영 규칙이다.

- 가사 원문과 그 번역은 저작물이다. 이 리포는 공개 리포라서 가사·번역을 커밋하면 공개 배포가 된다.
- 가사·번역은 로컬 DB에만 저장한다. 번역 작업용 파일은 `.local/`에 두고, 백업 파일은 `backups/`에 생긴다. 두 폴더 모두 `.gitignore`에 들어 있다.
- 가사는 사용자 본인만 본다. 앱을 외부에 공개하기 전에는 가사 화면을 사설 접속이나 인증 뒤에 둔다(#25 서비스 범위의 공개 전 조건).
- 테스트에는 직접 지은 짧은 문장만 쓴다.

## 2. 가사 번역

**2026-10-31 변경(#35):** 아래 표와 순서의 "Claude Code 세션에서 번역"은 할 수 없다. Claude Code는 저작권이 있는 가사 전문을 옮기거나 번역해 주지 않는다. 번역 파일을 채우는 일은 사용자가 직접 하거나 다른 번역 도구로 하고, 내보내기·들여오기 스크립트(#64)와 화면 붙여 넣기로 넣는다. 아래는 당시 비교 기록으로 남긴다.

| 방식                                               | 장점                                                  | 단점                                                   |
| -------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| 화면을 열 때마다 Claude API 호출                   | 바로 볼 수 있음                                       | 같은 곡을 여러 번 번역해 비용이 계속 나감. API 키 필요 |
| 가져올 때 Claude API로 한 번 번역해 저장           | 자동으로 많이 처리함                                  | API 키와 레지스트리 설정 필요                          |
| **Claude Code 세션에서 번역해 넣기 (사용자 결정)** | API 키·추가 비용이 없음. 번역을 대화로 다듬을 수 있음 | 곡이 많으면 여러 번에 나눠 해야 함                     |

정한 방식의 순서:

1. 내보내기 스크립트가 번역이 없는 곡의 가사를 줄 번호와 함께 `.local/translations/<곡 ID>.json`으로 내보낸다.
2. Claude Code 세션에서 그 파일을 읽어 줄 수가 같은 한국어 번역을 같은 파일에 채운다.
3. 들여오기 스크립트가 줄 수가 맞는지 확인하고 DB에 줄 단위로 저장한다. 줄 수가 다르면 저장하지 않고 알린다.

- 앨범 단위로 나눠 진행한다. 진행 상황은 DB의 "번역 있음" 여부로 확인한다.
- 이 방식은 가사를 Claude Code(Anthropic) 쪽으로 보낸다. 앱이 외부 API를 직접 부르지는 않지만, 가사가 제3자 서비스로 전달된다는 점은 같다.
- 앱이 Claude API를 쓰지 않으므로 중앙 레지스트리의 `features.claude`는 꺼 둔 채로 둔다.

## 3. 곡 목록과 "전곡" 범위

### 곡 목록 출처: MusicBrainz

- [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) API에서 아티스트 → 앨범(release group) → 수록곡 목록을 받는다.
- 핵심 데이터(아티스트, 앨범, 곡 이름)는 CC0(퍼블릭 도메인)이라 곡 목록은 저장하고 공개해도 된다.
- 요청 제한은 IP당 평균 1회/초이고, 앱을 알아볼 수 있는 `User-Agent`가 필요하다.

### 범위 (사용자 결정)

테일러 스위프트의 정규 앨범은 12장이다(2026-10 기준). 마지막은 2025-10-03에 나온 _The Life of a Showgirl_이다.

1. 정규 앨범 12장의 기본판 수록곡: _Taylor Swift_, _Fearless_, _Speak Now_, _Red_, _1989_, _reputation_, _Lover_, _folklore_, _evermore_, _Midnights_, _The Tortured Poets Department_, _The Life of a Showgirl_
2. Taylor's Version 4장(_Fearless_, _Red_, _Speak Now_, _1989_)의 From the Vault 곡만. 다시 녹음한 곡은 가사가 대부분 원곡과 같아 넣지 않는다. 가사가 바뀐 곡(예: _Speak Now (Taylor's Version)_의 "Better than Revenge")은 원곡 가사를 쓰고, 바뀐 줄은 곡 메모에 적는다.
3. 디럭스판 보너스 곡, 싱글·OST 곡은 2단계로 미룬다.

같은 곡이 여러 앨범에 있으면 곡 하나로 저장하고 수록 앨범을 여러 개 연결한다.

## 4. 자주 쓰는 단어

[NGSL(New General Service List) 1.2](https://www.newgeneralservicelist.com/new-general-service-list)를 쓴다.

- 영어 학습자를 위한 일반·일상 영어 핵심 단어 2,809개다.
- 라이선스는 CC BY-SA 4.0이다. 출처(Browne, Culligan, Phillips)를 표기해야 하고, 고친 목록을 배포하면 같은 라이선스를 따라야 한다.
- 공식 사이트는 `newgeneralservicelist.com` 하나뿐이라고 밝힌다. 그곳에서만 받는다.
- 빈도 통계가 있는 버전을 받아 빈도 순위를 저장한다.
- 한국어 뜻과 예문은 Claude Code 세션에서 만들어 저장하고(가사와 달리 저작권 있는 글을 옮기는 일이 아니다), AI가 만든 값이라고 표시한다. 빈도가 높은 단어부터 나눠 진행한다.

## 5. 어원

- 근거 자료는 Wiktionary의 영어 어원 글이다. [kaikki.org](https://kaikki.org/)가 Wiktionary 덤프에서 뽑은 JSON 자료(wiktextract)를 받는다.
- Wiktionary 글의 라이선스는 CC BY-SA다. 자료마다 3.0과 4.0 표기가 섞여 있어, 받을 때 kaikki.org의 표기를 기록한다.
- Wiktionary 어원은 문장이라 접두사·어근·접미사로 나뉘어 있지 않다. Claude Code 세션에서 어원 글을 근거로 요소를 나누고 한국어로 설명한다. 근거 글이 없는 단어는 "어원 자료 없음"으로 두고 지어내지 않는다.
- 화면에 출처(Wiktionary 링크)와 AI 정리 여부를 함께 보여 준다.

## 6. 공통 규칙

- 외부 자료를 받는 스크립트는 받은 원본을 리포 밖(로컬 DB나 `.local/`)에 둔다. 출처 URL과 받은 날짜를 함께 저장한다.
- 공개 리포에 넣어도 되는 것은 곡 목록(CC0)과 스크립트 코드뿐이다. NGSL·Wiktionary 자료를 리포에 넣으려면 CC BY-SA 표기를 함께 넣어야 하므로, 처음에는 넣지 않는다.

## 출처

- [ytmusicapi 문서](https://ytmusicapi.readthedocs.io/en/stable/)
- [YouTube 서비스 약관](https://www.youtube.com/static?template=terms)
- [LRCLIB API 문서](https://lrclib.net/docs)
- Genius API가 가사를 주지 않는다는 기록: [Getting Song Lyrics from Genius’s API + Scraping](https://bigishdata.com/2016/09/27/getting-song-lyrics-from-geniuss-api-scraping/)
- Musixmatch 무료 등급 30% 제한: [Musixmatch API (API 목록)](https://freeapihub.com/apis/musixmatch)
- [MusicBrainz API 요청 제한](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [NGSL 1.2](https://www.newgeneralservicelist.com/new-general-service-list)
- [kaikki.org](https://kaikki.org/)
