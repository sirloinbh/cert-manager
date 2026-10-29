# #10 공통 디자인 시스템으로 화면 전환

- 이슈: [#10](https://github.com/sirloinbh/english-study/issues/10) (중앙 추적 이슈 sirloinbh/project-standards#126)
- 브랜치: `feat/10-design-system`

## 목적

8개 앱이 같은 토큰·컴포넌트·레이아웃·PWA 설정을 쓰기로 했다(중앙 ADR-0007, ADR-0008). 방법은 중앙 `docs/design-system.md` "기존 앱 전환"을 따랐다(workout-memo#160이 먼저 적용).

## 변경 — 2026-10-26

### 패키지

사용자가 직접 설치했다. 중앙 ADR-0007 표의 패키지(2026-10-22 사전 승인)와 react-router·vitest·jsdom·Testing Library(2026-10-26 승인)다. 모두 고정 버전, 게시 14일 경과, `--ignore-scripts`.

- dependencies: `@sirloinbh/design-tokens` 1.0.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `radix-ui` 1.7.0, `react-router` 8.4.0, `sonner` 2.0.8, `tailwind-merge` 3.7.0, `tw-animate-css` 1.4.0, `vaul` 1.1.2, `lucide-react` 0.468.0 → 1.52.0
- devDependencies: `tailwindcss`·`@tailwindcss/vite` 4.3.3, `vitest` 5.0.3, `jsdom` 30.1.2, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1
- lockfile 두 개(루트, `frontend/`): 지워진 패키지 없음, 버전이 바뀐 것은 `lucide-react`뿐. 새 항목은 모두 공식 레지스트리·무결성 값 있음·설치 스크립트 없음. `ioc-scan`: 의심 항목 없음

### 공통 파일 (중앙 관리)

중앙에서 이 앱의 `features.ui`·`features.vitest`를 켠 동기화 미리보기에서 뽑은 그대로다: `frontend/src/components/ui/` 15개와 테스트, `components/layout/`, `lib/utils.ts`·`theme.ts`, `public/theme-init.js`, `frontend/vitest.config.ts`.

### 앱 코드

- **화면:** 자체 셸(사이드바·헤더)을 `AppShell`로 바꾸고 페이지 주소를 붙였다(`/`, `/settings`). 자체 `style.css`는 지우고 공통 토큰과 `EmptyState`를 쓴다.
- **진입점:** `app.tsx`(화면), `main.tsx`(렌더링과 운영 빌드에서만 서비스 워커 등록), `index.css`(Tailwind, `tw-animate-css`, 공통 토큰).
- **PWA:** 아이콘 4개(중앙 `scripts/pwa-icons.mjs`), `index.html`의 manifest·아이콘·라이트/다크 `theme-color`·`viewport-fit=cover`·깜빡임 방지 스크립트.
- **테스트·빌드:** `frontend`에 `test`(vitest) 스크립트와 `src/test/setup.ts`를 넣고, 루트 `npm test`가 프론트엔드 테스트도 돌린다. 운영 빌드는 `tsconfig.build.json`으로 테스트 파일을 뺀다. `vite.config.ts`에 Tailwind 플러그인.
- **백엔드의 화면 테스트 삭제:** `backend/test/app-ui.test.ts`는 Vitest가 없을 때 가짜 React로 `main.tsx`를 실행해 보던 임시 테스트다. 같은 내용(제목·서버 상태·오류 알림·메뉴 이동)을 프론트엔드 Vitest 테스트가 실제 React로 검사하므로 지웠다.
- **화면 테스트(`app.test.tsx`):** 서버 날짜 표시, 서버 오류 알림, 메뉴로 페이지 이동과 현재 페이지 표시, 알 수 없는 주소 처리.

## 검증

- Prettier, ESLint, `tsc`(전체), 프론트엔드 테스트 40개 통과, `vite build`, `ioc-scan`
- 백엔드 테스트는 DB가 필요해 CI에서 확인한다.

## 검증 보완 — 2026-10-29 ([#20](https://github.com/sirloinbh/english-study/issues/20))

PR #11 병합 때 빠진 `npm run check` 전체 결과와 실제 브라우저 확인을 사후에 채웠다. 확인 시점의 main에는 #11 뒤에 중앙 표준 동기화(#12·#13·#16·#17, 브라우저 확인은 #18까지)와 보안 업데이트 #14가 더해져 있어, #11 직후 화면과 완전히 같지는 않다.

- `npm run check` (Node 24.21.0 / npm 11.19.0, main `0f1f171`): 통과. 백엔드 테스트 5개 중 4개 통과·1개 건너뜀(`TEST_DATABASE_URL` 미설정으로 DB 통합 테스트 건너뜀, 성공으로 세지 않음). 프론트엔드 Vitest 20개 파일·52개 통과. 스킬 테스트 4개 통과. 빌드 성공.
- 브라우저 확인 (main `3e56615`): 임시 PostgreSQL 17 컨테이너(마이그레이션 `001` 적용)와 `npm run dev`의 API·Vite 서버를 띄우고, 설치된 Chrome headless를 DevTools 프로토콜로 화면 크기를 지정해 `/`와 `/settings`를 열었다.

| 화면   | 크기     | 결과                                                                                                |
| ------ | -------- | --------------------------------------------------------------------------------------------------- |
| 모바일 | 390×844  | 가로 넘침 없음(문서 너비 390). 헤더에 메뉴·테마 버튼, "서버 연결됨 · 2026-10-29", 빈 화면 안내 표시 |
| PC     | 1440×900 | 가로 넘침 없음. 사이드바에서 현재 페이지 강조, 헤더 테마 버튼, 서버 상태, 빈 화면 안내 표시         |

- 관찰: 모바일에서 빈 화면 안내 문구가 "추가합니 / 다."처럼 단어 중간에서 줄바꿈된다. `EmptyState`는 중앙 관리 파일이라 이 리포에서 고치지 않는다.
- 한계: Chrome 창 크기 옵션(`--window-size`)만으로는 headless 창이 최소 504px로 잡혀 390px 확인이 되지 않았다. 그래서 DevTools 프로토콜의 화면 크기 지정(`Emulation.setDeviceMetricsOverride`)으로 다시 확인했다. 다크 모드와 메뉴 열기 동작은 확인하지 않았다.
