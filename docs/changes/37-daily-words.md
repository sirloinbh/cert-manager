# #37 오늘의 영어 단어

이슈: [#37](https://github.com/sirloinbh/cert-manager/issues/37)

## 목적

단어장은 직접 열어야만 보인다. 매일 정해진 단어를 대시보드에 보여 주고, 외운 단어를 기록해 꾸준히 외울 수 있게 한다.

## 정한 규칙

사용자가 추천안대로 진행하라고 했다(2026-11-01). 이슈에도 같은 내용을 적었다.

- 하루 5단어. 그날 처음 열 때 정하고, 그날은 같은 단어를 보여 준다.
- 외운 단어는 고르지 않는다.
- 고르는 순서: 뜻을 채운 단어 → 가장 오래전에 나온 단어(아직 안 나온 단어가 맨 앞) → 빈도 순.
- 뜻을 채운 단어를 앞세운 이유: 뜻 채우기(#70)가 끝나기 전에도 뜻을 볼 수 있는 단어를 먼저 보여 주기 위해서다. 뜻이 있는 단어가 모자라면 뜻 없는 단어로 채운다.
- 안 본 단어가 다 떨어지면 외우지 않은 단어가 오래된 순으로 다시 나온다.
- 지난 날은 그날을 연 적이 있을 때만 기록이 있다. 지난 날을 열어도 새로 고르지 않는다.

## 변경 내용

- `database/migrations/009_daily_words.sql`: `daily_words` 테이블과 `words.learned_at` 열.
- `backend/src/routes/daily-words.ts`:
  - `GET /api/daily-words`: 오늘의 단어. `?day=YYYY-MM-DD`로 지난 날을 본다. 오늘 이후는 400이다.
  - `PUT /api/words/:id/learned`: 외웠어요 표시와 취소. 다시 표시해도 처음 시점을 유지한다.
- `backend/src/routes/words.ts`: 출처를 읽는 함수를 내보냈다.
- `frontend/src/daily-words.tsx`: 대시보드 카드. 뜻·예문·어원은 눌러서 펼치고, 단어를 누르면 상세로 간다. 화살표로 지난 날을 본다.
- `frontend/src/words.tsx`: 라이선스 표기(`SourceNote`)를 카드에서도 쓰도록 내보냈다.
- 대시보드를 그리는 기존 테스트의 가짜 API에 `words: []`를 넣었다.
- `docs/design/scope-and-data-model.md` 6절에 규칙을 적었다.

## 테스트

- `backend/test/words.integration.test.ts`: 동시 요청, 같은 날 같은 단어, 다음 날 새 단어, 외운 단어 제외, 취소, 뜻 있는 단어 우선, 모두 외운 경우. 단어 표 전체를 보는 #36 테스트와 동시에 돌지 않도록 같은 파일에 넣었다.
- `backend/test/daily-words.test.ts`: 서울 자정 경계, 잘못된 날짜, 오늘만 단어를 고르는 것, 입력 검사.
- `frontend/src/daily-words.test.tsx`: 접기와 펼치기, 뜻 없는 단어, 외웠어요와 취소, 저장 실패, 지난 날 이동, 빈 상태, 불러오기 실패.

## 검증

`TEST_DATABASE_URL`을 `cert_test`로 지정하고 실행했다. 마이그레이션은 `cert`, `cert_test`에 모두 적용했다.

- `npm run check`: 통과. 백엔드 108개 통과, 프런트엔드 229개 통과·2개 건너뜀(`DARK_ONLY`), 스킬 4개 통과, 빌드 성공.
- `npm run knip`: 결과 없음.
- `node .standards/check.mjs`: 통과.
- `node .standards/secret-scan.mjs`: 의심 항목 없음.
- 화면: 헤드리스 Edge로 `cert_test`에 지어낸 단어 7개를 넣어 390×844, 1440×900에서 확인했다. 가로 넘침 없음, 긴 단어 줄바꿈 정상, 콘솔 오류·경고 없음. 외웠어요가 새로고침 뒤에도 유지되고, 지난 날 이동과 상세 이동이 동작했다. 터치 환경을 흉내 내지 않아 `pointer-coarse`의 큰 터치 영역은 확인하지 못했다. 확인 뒤 임시 데이터를 지웠다.

## 제한·후속 작업

- 뜻과 예문은 아직 비어 있어(#70) 지금은 단어와 어원만 보인다.
- 외운 단어를 단어장이나 상세 화면에서 표시하고 모아 보는 기능은 범위 밖이다.
- 푸시 알림은 이슈 범위 밖이다.
