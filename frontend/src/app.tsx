import { Award, BookOpenText, LayoutDashboard, Music, Settings2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, generatePath, Navigate, Route, Routes } from 'react-router';

import {
  CertificationDetail,
  CertificationList,
  type CertificationPaths,
  EditCertification,
  NewCertification,
  UpcomingExams,
} from './certifications';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { EmptyState } from './components/ui/empty-state';
import { Toaster } from './components/ui/sonner';
import { type Health, healthText } from './health';

// Every page URL lives here (central docs/directory-rules.md, docs/design/scope-and-data-model.md section 3).
const pages = {
  overview: '/',
  certifications: '/certifications',
  newCertification: '/certifications/new',
  certification: '/certifications/:id',
  editCertification: '/certifications/:id/edit',
  songs: '/songs',
  words: '/words',
  settings: '/settings',
} as const;

const certificationPaths: CertificationPaths = {
  list: pages.certifications,
  create: pages.newCertification,
  detail: (id) => generatePath(pages.certification, { id: String(id) }),
  edit: (id) => generatePath(pages.editCertification, { id: String(id) }),
};

// Main menu (LNB) items, in display order.
const nav: NavItem[] = [
  { to: pages.overview, label: '대시보드', icon: LayoutDashboard },
  { to: pages.certifications, label: '자격증', icon: Award },
  { to: pages.songs, label: '팝송 가사', icon: Music },
  { to: pages.words, label: '단어장', icon: BookOpenText },
  { to: pages.settings, label: '설정', icon: Settings2 },
];

function useHealth() {
  const [health, setHealth] = useState<Health>({ state: 'loading' });
  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        const data = (await response.json()) as { today?: string; error?: string };
        setHealth(
          response.ok && data.today
            ? { state: 'ok', today: data.today }
            : { state: 'error', message: data.error ?? '서버 상태를 확인할 수 없습니다' },
        );
      })
      .catch(() => setHealth({ state: 'error', message: '서버에 연결할 수 없습니다' }));
  }, []);
  return health;
}

function Page({
  title,
  description,
  health,
  children,
}: {
  title: string;
  description: string;
  health: Health;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">{title}</h1>
        <p className="text-body text-muted-foreground">{description}</p>
        {health.state === 'error' ? (
          <p role="alert" className="text-body-sm text-destructive">
            {healthText(health)}
          </p>
        ) : (
          <p role="status" className="text-caption text-muted-foreground">
            {healthText(health)}
          </p>
        )}
      </header>
      {children ?? (
        <EmptyState
          title="아직 기능이 없습니다"
          description="기능은 GitHub 이슈 카드로 등록한 뒤 하나씩 추가합니다."
        />
      )}
    </section>
  );
}

export function App() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <AppShell appName="자격증 관리" nav={nav}>
        <Routes>
          <Route
            path={pages.overview}
            element={
              <Page
                title="대시보드"
                description="자격증 목표와 영어 공부에서 오늘 볼 것을 모아 봅니다."
                health={health}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <UpcomingExams paths={certificationPaths} />
                </div>
              </Page>
            }
          />
          <Route
            path={pages.certifications}
            element={<CertificationList paths={certificationPaths} />}
          />
          <Route
            path={pages.newCertification}
            element={<NewCertification paths={certificationPaths} />}
          />
          <Route
            path={pages.certification}
            element={<CertificationDetail paths={certificationPaths} />}
          />
          <Route
            path={pages.editCertification}
            element={<EditCertification paths={certificationPaths} />}
          />
          <Route
            path={pages.songs}
            element={
              <Page
                title="팝송 가사"
                description="팝송 가사 원문과 번역을 줄 단위로 봅니다."
                health={health}
              />
            }
          />
          <Route
            path={pages.words}
            element={
              <Page
                title="단어장"
                description="가사에 자주 나오는 단어와 어원을 봅니다."
                health={health}
              />
            }
          />
          <Route
            path={pages.settings}
            element={<Page title="설정" description="앱 환경과 데이터 관리" health={health} />}
          />
          <Route path="*" element={<Navigate to={pages.overview} replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}
