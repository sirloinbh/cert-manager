# #26 GitHub 리포 이름 바꾸기와 DB 이름 맞추기

- 이슈: [#26](https://github.com/sirloinbh/cert-manager/issues/26)
- 결정: [#25](https://github.com/sirloinbh/cert-manager/issues/25), 중앙 변경 [sirloinbh/project-standards#347](https://github.com/sirloinbh/project-standards/issues/347)

## 목적

리포 이름을 `english-study`에서 `cert-manager`로 바꾸면서 중앙 레지스트리의 DB 이름도 `english`에서 `cert`로 바뀌었다. 이 리포가 관리하는 설정 파일의 DB 이름을 레지스트리 값에 맞춘다.

## 변경 — 2026-10-30

- 사용자가 GitHub 리포 4개(`cert-manager`, `-frontend`, `-backend`, `-db`)의 이름을 바꿨다.
- 중앙 PR [project-standards#349](https://github.com/sirloinbh/project-standards/pull/349)를 병합했고, 동기화 PR #29가 열렸다.
- 동기화 PR #29의 `standards-check`가 `.env.example`의 DB 이름 `english`를 레지스트리 값 `cert`와 다르다고 실패했다. `.env.example`은 이 리포가 관리하는 파일이라 동기화로 바뀌지 않는다.
- `.env.example`: `POSTGRES_DB`, `POSTGRES_USER`, `DATABASE_URL`을 `cert`로 바꿨다.
- `compose.yaml`: `POSTGRES_DB`·`POSTGRES_USER` 기본값을 `cert`로 맞췄다.

고치지 않은 것: `compose.yaml`의 Docker 볼륨 이름 `english-study-data`는 바꾸면 로컬 DB 데이터가 새 빈 볼륨으로 갈라진다. 로컬 DB 옮기기(#26 사용자 단계)와 함께 정한다. 패키지 이름, `/api/health`의 `service` 값, 하위 리포 CI 이미지 이름은 [#27](https://github.com/sirloinbh/cert-manager/issues/27)에서 바꾼다.

## 로컬 환경 주의

이미 만든 로컬 `.env`는 그대로 `english`를 쓰고 있어 지금도 동작한다. 기존 Docker 볼륨은 `english` 사용자·DB로 초기화되어 있으므로 `.env`만 `cert`로 바꾸면 접속이 실패한다. DB를 옮길 때 함께 바꾼다.

## 검증

- `node .standards/check.mjs`: 결과는 PR 코멘트에 기록
