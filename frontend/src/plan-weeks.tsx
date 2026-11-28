import { Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { certificationApi, type CertificationPaths } from './certification-data';
import { addDays, weekDays, weekStart } from './components/period-nav/periods';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { formatDate } from './lib/format';
import { plural } from './lib/format';
import { errorText } from './lib/use-notice';
import { studyPlanApi } from './study-plan-data';
import { useLoad } from './use-load';
import { upcomingWeeks, weekTitle } from './week-range';

const weekCount = 12;

const weekdayName = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

const loadGoals = () => certificationApi.list();

const linkClass =
  'truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50';

// One week (#217): the exams and the study tasks of each day, Sunday to Saturday. Earlier and later weeks can be opened.
export function Week({ today, paths }: { today: string; paths: CertificationPaths }) {
  const thisWeek = weekStart(today);
  const [start, setStart] = useState(thisWeek);
  const days = weekDays(start);
  const tasks = useLoad(`${days[0]}/${days[6]}`, (key) => {
    const [from, to] = key.split('/');
    return studyPlanApi.range(from, to);
  });
  const goals = useLoad('all', loadGoals);
  const failed = tasks.state === 'error' || goals.state === 'error';
  const ready = tasks.state === 'ok' && goals.state === 'ok';
  const exams =
    goals.state === 'ok'
      ? goals.data.certifications.filter(
          (item) => item.targetExamDate !== null && days.includes(item.targetExamDate),
        )
      : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          {weekTitle(start)}
        </CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            aria-label="Previous week"
            onClick={() => setStart(addDays(start, -7))}
          >
            Previous
          </Button>
          {start !== thisWeek ? (
            <Button type="button" variant="outline" onClick={() => setStart(thisWeek)}>
              This week
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            aria-label="Next week"
            onClick={() => setStart(addDays(start, 7))}
          >
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!ready && !failed ? <SkeletonList rows={3} /> : null}
        {failed ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(
                tasks.state === 'error' ? tasks.error : goals.state === 'error' && goals.error,
                'Could not load the week',
              ),
            }}
          />
        ) : null}
        {ready ? (
          <ul className="flex flex-col divide-y">
            {days.map((day) => {
              const dayTasks = tasks.data.tasks.filter((task) => task.dueDate === day);
              const dayExams = exams.filter((item) => item.targetExamDate === day);
              return (
                <li key={day} aria-label={`${weekdayName(day)} ${day}`} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <strong>{weekdayName(day)}</strong>
                    <time dateTime={day} className="text-caption text-muted-foreground">
                      {formatDate(day)}
                      {day === today ? ' · Today' : ''}
                    </time>
                  </div>
                  {dayExams.length === 0 && dayTasks.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground">Nothing planned</p>
                  ) : null}
                  {dayExams.map((item) => (
                    <p key={`exam-${item.id}`} className="text-body-sm break-keep">
                      Exam:{' '}
                      <Link to={paths.detail(item.id)} className={linkClass}>
                        {item.name}
                      </Link>
                    </p>
                  ))}
                  {dayTasks.map((task) => (
                    <p key={task.id} className="flex items-center gap-2 text-body-sm break-keep">
                      {task.completedAt === null ? null : (
                        <Check className="size-4 shrink-0" aria-label="Done" />
                      )}
                      <Link to={paths.detail(task.certificationId)} className={linkClass}>
                        {task.title}
                      </Link>
                      <span className="truncate text-caption text-muted-foreground">
                        {task.certificationName}
                      </span>
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

// The next 12 weeks side by side (#217), starting with this week: the study tasks done and in all, and the exams, of each.
export function Weeks({ today }: { today: string }) {
  const first = weekStart(today);
  const last = addDays(first, 7 * weekCount - 1);
  const tasks = useLoad(`${first}/${last}`, (key) => {
    const [from, to] = key.split('/');
    return studyPlanApi.range(from, to);
  });
  const goals = useLoad('all', loadGoals);
  const failed = tasks.state === 'error' || goals.state === 'error';
  const weeks =
    tasks.state === 'ok' && goals.state === 'ok'
      ? upcomingWeeks(
          tasks.data.tasks,
          goals.data.certifications.map((item) => item.targetExamDate),
          today,
          weekCount,
        )
      : undefined;
  const most = Math.max(1, ...(weeks ?? []).map((week) => week.tasks));
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          Next {weekCount} weeks
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!weeks && !failed ? <SkeletonList rows={3} /> : null}
        {failed ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(
                tasks.state === 'error' ? tasks.error : goals.state === 'error' && goals.error,
                'Could not load the weeks',
              ),
            }}
          />
        ) : null}
        {weeks ? (
          <ul className="flex flex-col divide-y">
            {weeks.map((week) => (
              <li key={week.start} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong>{weekTitle(week.start)}</strong>
                  <span className="text-body-sm text-muted-foreground">
                    {week.tasks === 0
                      ? 'No tasks'
                      : `${week.done} of ${plural(week.tasks, 'task')} done`}
                    {week.exams > 0 ? ` · ${plural(week.exams, 'exam')}` : ''}
                  </span>
                </div>
                <div aria-hidden="true" className="mt-2 h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{ width: `${Math.round((week.tasks / most) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

const loadProgress = () => studyPlanApi.progress();

// The dashboard card (#217): how many study tasks of each goal are done.
export function PlanProgress({ paths }: { paths: CertificationPaths }) {
  const loaded = useLoad('progress', loadProgress);
  const goals = loaded.state === 'ok' ? loaded.data.goals : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          Study plan progress
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loaded.state === 'loading' ? <SkeletonList rows={2} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(loaded.error, 'Could not load the plan progress'),
            }}
          />
        ) : null}
        {loaded.state === 'ok' && goals.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            No study plans yet. Add stages and tasks to a certification goal and its progress shows
            up here.
          </p>
        ) : null}
        {goals.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {goals.map((goal) => (
              <li key={goal.certificationId} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link to={paths.detail(goal.certificationId)} className={linkClass}>
                    {goal.certificationName}
                  </Link>
                  <span className="text-body-sm text-muted-foreground">
                    {goal.done} of {plural(goal.total, 'task')} done
                  </span>
                </div>
                <div aria-hidden="true" className="mt-2 h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{ width: `${Math.round((goal.done / goal.total) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
