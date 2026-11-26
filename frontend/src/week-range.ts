const dayMs = 24 * 60 * 60 * 1000;

const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** "2026-11-26" moved by `delta` days. */
export function addDays(day: string, delta: number) {
  return new Date(toTime(day) + delta * dayMs).toISOString().slice(0, 10);
}

/** The Sunday on or before `day`; weeks run Sunday to Saturday. */
export const weekStart = (day: string) => addDays(day, -new Date(toTime(day)).getUTCDay());

/** The seven dates of the week that starts on `start`. */
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** "Nov 22 – Nov 28" for the week that starts on `start`. */
export function weekTitle(start: string) {
  const format = (day: string) =>
    new Date(toTime(day)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${format(start)} – ${format(addDays(start, 6))}`;
}

export type WeekTotal = { start: string; tasks: number; done: number; exams: number };

/**
 * `count` weeks from the week of `today` on, soonest first, with the tasks (and how many are done) and the
 * exams that fall in each. Items outside those weeks are ignored.
 */
export function upcomingWeeks(
  tasks: { dueDate: string | null; completedAt: string | null }[],
  examDays: (string | null)[],
  today: string,
  count: number,
): WeekTotal[] {
  const first = weekStart(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(first, 7 * i);
    const end = addDays(start, 6);
    const inWeek = (day: string | null) => day !== null && day >= start && day <= end;
    const due = tasks.filter((task) => inWeek(task.dueDate));
    return {
      start,
      tasks: due.length,
      done: due.filter((task) => task.completedAt !== null).length,
      exams: examDays.filter(inWeek).length,
    };
  });
}
