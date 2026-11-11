import { Award, BookOpenText, LayoutDashboard, Music, Settings2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, generatePath, Navigate, Route, Routes } from 'react-router';

import type { CertificationPaths } from './certification-data';
import {
  CertificationDetail,
  CertificationList,
  EditCertification,
  NewCertification,
  UpcomingExams,
} from './certifications';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { EmptyState } from './components/ui/empty-state';
import { Toaster } from './components/ui/sonner';
import { DailyWords } from './daily-words';
import { ExpiringCertifications } from './exam-attempts';
import { type Health, healthText } from './health';
import type { SongPaths } from './song-data';
import { SongDetail, SongList } from './songs';
import { TodayTasks } from './study-plan';
import { UserActionAlerts } from './user-actions';
import type { WordPaths } from './word-data';
import { WordDetail, WordList } from './words';

// Every page URL lives here (central docs/directory-rules.md, docs/design/scope-and-data-model.md section 3).
const pages = {
  overview: '/',
  certifications: '/certifications',
  newCertification: '/certifications/new',
  certification: '/certifications/:id',
  editCertification: '/certifications/:id/edit',
  songs: '/songs',
  song: '/songs/:id',
  words: '/words',
  word: '/words/:id',
  settings: '/settings',
} as const;

const certificationPaths: CertificationPaths = {
  list: pages.certifications,
  create: pages.newCertification,
  detail: (id) => generatePath(pages.certification, { id: String(id) }),
  edit: (id) => generatePath(pages.editCertification, { id: String(id) }),
};

const songPaths: SongPaths = {
  list: pages.songs,
  detail: (id) => generatePath(pages.song, { id: String(id) }),
};

const wordPaths: WordPaths = {
  list: pages.words,
  detail: (id) => generatePath(pages.word, { id: String(id) }),
};

// Main menu (LNB) items, in display order.
const nav: NavItem[] = [
  { to: pages.overview, label: 'Dashboard', icon: LayoutDashboard },
  { to: pages.certifications, label: 'Certifications', icon: Award },
  { to: pages.songs, label: 'Song lyrics', icon: Music },
  { to: pages.words, label: 'Vocabulary', icon: BookOpenText },
  { to: pages.settings, label: 'Settings', icon: Settings2 },
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
            : { state: 'error', message: data.error ?? 'Could not check the server status' },
        );
      })
      .catch(() => setHealth({ state: 'error', message: 'Could not connect to the server' }));
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
          className="break-keep"
          title="No features yet"
          description="Features are registered as GitHub issue cards and added one at a time."
        />
      )}
    </section>
  );
}

export function App() {
  const health = useHealth();
  return (
    // The song search box takes its value from the URL, and React says not to update a typed value in a transition.
    <BrowserRouter useTransitions={false}>
      <AppShell appName="Cert Manager" nav={nav} actions={<UserActionAlerts />}>
        <Routes>
          <Route
            path={pages.overview}
            element={
              <Page
                title="Dashboard"
                description="See what to look at today from your certification goals and English study."
                health={health}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <UpcomingExams paths={certificationPaths} />
                  <TodayTasks paths={certificationPaths} />
                  <ExpiringCertifications paths={certificationPaths} />
                  <DailyWords paths={wordPaths} />
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
          <Route path={pages.songs} element={<SongList paths={songPaths} />} />
          <Route path={pages.song} element={<SongDetail paths={songPaths} />} />
          <Route path={pages.words} element={<WordList paths={wordPaths} />} />
          <Route path={pages.word} element={<WordDetail paths={wordPaths} />} />
          <Route
            path={pages.settings}
            element={
              <Page
                title="Settings"
                description="App environment and data management"
                health={health}
              />
            }
          />
          <Route path="*" element={<Navigate to={pages.overview} replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}
