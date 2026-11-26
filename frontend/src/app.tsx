import { QueryClientProvider } from '@tanstack/react-query';
import {
  Award,
  BookOpenText,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  ListTodo,
  Music,
  Settings2,
} from 'lucide-react';
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
import { createQueryClient } from './lib/query';
import { PlanProgress, Week, Weeks } from './plan-weeks';
import { AccountActions, SignInGate } from './sign-in';
import type { SongPaths } from './song-data';
import { SongDetail, SongList } from './songs';
import { TodayTasks } from './study-plan';
import { UserActionAlerts } from './user-actions';
import { serviceToday, type WordPaths } from './word-data';
import { DueWordsCard } from './word-review';
import { WordDetail, WordList } from './words';

// Every page URL lives here (central docs/directory-rules.md, docs/design/scope-and-data-model.md section 3).
const pages = {
  today: '/',
  week: '/week',
  weeks: '/weeks',
  dashboard: '/dashboard',
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
  { to: pages.today, label: 'Today', icon: ListTodo },
  { to: pages.week, label: 'Week', icon: CalendarDays },
  { to: pages.weeks, label: '12 weeks', icon: CalendarRange },
  { to: pages.certifications, label: 'Certifications', icon: Award },
  { to: pages.songs, label: 'Song lyrics', icon: Music },
  { to: pages.words, label: 'Vocabulary', icon: BookOpenText },
  { to: pages.dashboard, label: 'Dashboard', icon: LayoutDashboard },
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

// The service date, kept current at midnight and when the tab is shown again.
function useServiceToday() {
  const [today, setToday] = useState(() => serviceToday());
  useEffect(() => {
    const refresh = () => setToday(serviceToday());
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
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

function AppRoutes() {
  const health = useHealth();
  const today = useServiceToday();
  return (
    // The song search box takes its value from the URL, and React says not to update a typed value in a transition.
    <BrowserRouter useTransitions={false}>
      <SignInGate>
        <AppShell
          appName="Cert Manager"
          nav={nav}
          actions={
            <>
              <UserActionAlerts />
              <AccountActions />
            </>
          }
        >
          <Routes>
            <Route
              path={pages.today}
              element={
                <Page
                  title="Today"
                  description="See what to study today: the tasks due and the words of the day."
                  health={health}
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <TodayTasks paths={certificationPaths} />
                    <DailyWords paths={wordPaths} />
                  </div>
                </Page>
              }
            />
            <Route
              path={pages.week}
              element={
                <Page
                  title="Week"
                  description="The exams and study tasks of each day of a week."
                  health={health}
                >
                  <Week today={today} paths={certificationPaths} />
                </Page>
              }
            />
            <Route
              path={pages.weeks}
              element={
                <Page
                  title="12 weeks"
                  description="The study tasks and exams of the next 12 weeks at a glance."
                  health={health}
                >
                  <Weeks today={today} />
                </Page>
              }
            />
            <Route
              path={pages.dashboard}
              element={
                <Page
                  title="Dashboard"
                  description="Upcoming exams, certifications about to expire and how far each study plan has come."
                  health={health}
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <UpcomingExams paths={certificationPaths} />
                    <ExpiringCertifications paths={certificationPaths} />
                    <PlanProgress paths={certificationPaths} />
                    <DueWordsCard paths={wordPaths} />
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
            <Route path="*" element={<Navigate to={pages.today} replace />} />
          </Routes>
        </AppShell>
        <Toaster />
      </SignInGate>
    </BrowserRouter>
  );
}

export function App() {
  // One client for the whole app, kept in state so a re-render does not make a new one.
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
