# 다음 작업

최종 갱신일: **2026-10-30 (Asia/Seoul)**.

## 우선 처리

| 순서 | 할 일                                   | 상태             | 다음 행동                                                                                                                                                                        |
| ---- | --------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 보안 업데이트 PR #15 처리 (`zod` 3 → 4) | CI `verify` 실패 | `npm audit`의 high 1건(`zod` < 4.6.6)이 이 PR로 해결된다. 주 버전 변경이라 백엔드 검증 코드 수정이 필요한지 확인하고 별도 이슈로 진행                                            |
| 2    | #26 로컬 환경 옮기기 마무리             | 사용자 단계 남음 | 새 폴더 `cert-manager`에 `node_modules`가 없다(사용자 승인 후 `npm ci --ignore-scripts`). 하위 리포 원격 3개(`frontend`, `backend`, `database`)도 다시 추가한 뒤 `npm run check` |
| 3    | #28 기능 범위와 데이터 구조             | 진행 전          | 끝나면 #30 목표 등록 → #32 만료일, #33 공부 계획 순서로 진행. 영어 공부는 #35·#36·#37                                                                                            |

## 함께 볼 것

- `npm run knip` 결과: 미사용 파일 2개(`.claude/hooks/block-package-installs.mjs`, `backend/src/standard/http.ts`), 미사용 export 1개(`backend/src/app.ts`의 `serviceTimeZone`). `knip`은 아직 `npm run check`에 들어 있지 않다. 앞의 두 파일은 중앙 관리 파일이라 중앙 `knip.json` 설정에서 다룬다.
- 모바일 빈 화면 안내 문구가 단어 중간에서 줄바꿈된다. 호출부 `frontend/src/app.tsx`에서 고치는 [#22](https://github.com/sirloinbh/english-study/issues/22)로 분리했다.
- 이 PC의 Volta 기본 Node(24.22.1)가 프로젝트 고정 버전(24.21.0)과 달라 `npm install`·`npm ci`가 엔진 검사에서 막힌다. 설치할 때는 `volta run --node 24.21.0 --npm 11.19.0 npm ...`을 쓴다.

## 실행 경계

배포, 하위 저장소 동기화, AWS 리소스 생성은 별도 요청 시에만 한다. 공유 인프라의 ECR 저장소는 첫 배포 때 `shared-aws-infrastructure`의 목록에 추가한다.
