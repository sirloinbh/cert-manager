import type { StudyStage } from './study-plan-data';

// Study pace (#212): how many tasks to finish a day to be ready for the exam, worked out in the browser
// from the plan and the days left. The screen is in study-pace.tsx.

export type StudyPace = {
  open: number;
  daysLeft: number;
  /** Open tasks divided by the days left, rounded up. */
  perDay: number;
  /** An open task is already past its due date, or more tasks are open than the plan expected by today. */
  behind: boolean;
};

const DAY_MS = 86_400_000;

/** Whole days from one `YYYY-MM-DD` day to another. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * The pace to keep, or null when there is nothing to pace: no exam date, an exam today or past, or no open tasks.
 * `daysUntilExam` counts from today, so today is the first of the days left.
 */
export function studyPace(
  stages: StudyStage[],
  daysUntilExam: number | null,
  examDate: string | null,
) {
  if (daysUntilExam === null || examDate === null || daysUntilExam <= 0) return null;
  const tasks = stages.flatMap((stage) => stage.tasks);
  const open = tasks.filter((task) => task.completedAt === null);
  if (open.length === 0) return null;

  const overdue = open.some((task) => task.daysUntilDue !== null && task.daysUntilDue < 0);

  // Expected open tasks today: the plan spreads all tasks evenly from its first start date to the exam.
  const starts = stages.flatMap((stage) => (stage.startDate ? [stage.startDate] : []));
  let behindSchedule = false;
  if (starts.length > 0) {
    const planDays = daysBetween(
      starts.reduce((a, b) => (a < b ? a : b)),
      examDate,
    );
    if (planDays > daysUntilExam) {
      const expectedOpen = Math.ceil((tasks.length * daysUntilExam) / planDays);
      behindSchedule = open.length > expectedOpen;
    }
  }

  return {
    open: open.length,
    daysLeft: daysUntilExam,
    perDay: Math.ceil(open.length / daysUntilExam),
    behind: overdue || behindSchedule,
  } satisfies StudyPace;
}
