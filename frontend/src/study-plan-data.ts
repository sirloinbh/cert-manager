import { requestJson } from './lib/api';

// Study plans (#33): API calls and display rules. The screens are in study-plan.tsx.
// Rules: docs/design/scope-and-data-model.md section 5.

export type StudyTask = {
  id: number;
  stageId: number;
  title: string;
  position: number;
  dueDate: string | null;
  /** Days from today (Asia/Seoul) to the due date; negative once it has passed. */
  daysUntilDue: number | null;
  /** When it was finished; null while it is not done. */
  completedAt: string | null;
};

export type StudyStage = {
  id: number;
  certificationId: number;
  title: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
  tasks: StudyTask[];
};

export type TodayTask = StudyTask & { certificationId: number; certificationName: string };

export type StudyPlan = { today: string; stages: StudyStage[] };

export type StageInput = Pick<StudyStage, 'title' | 'startDate' | 'endDate'>;
export type TaskInput = Pick<StudyTask, 'title' | 'dueDate'>;

/** Finished tasks out of all of them; null when there are none, because 0% would say nothing. */
export function progress(tasks: StudyTask[]) {
  if (tasks.length === 0) return null;
  const done = tasks.filter((task) => task.completedAt !== null).length;
  return { done, total: tasks.length, percent: Math.round((done / tasks.length) * 100) };
}

/** The plan as the user just chose it: checks still being saved count at once, so progress moves on the click. */
export function withChoices(stages: StudyStage[], choices: Record<number, boolean>) {
  return stages.map((stage) => ({
    ...stage,
    tasks: stage.tasks.map((task) => {
      const choice = choices[task.id];
      if (choice === undefined) return task;
      return { ...task, completedAt: choice ? (task.completedAt ?? 'saving') : null };
    }),
  }));
}

export const isOverdue = (task: Pick<StudyTask, 'completedAt' | 'daysUntilDue'>) =>
  task.completedAt === null && task.daysUntilDue !== null && task.daysUntilDue < 0;

/** The stage's period in words; empty when neither date is set. */
export function periodText(stage: Pick<StudyStage, 'startDate' | 'endDate'>) {
  if (stage.startDate && stage.endDate) return `${stage.startDate} ~ ${stage.endDate}`;
  if (stage.startDate) return `${stage.startDate}부터`;
  return stage.endDate ? `${stage.endDate}까지` : '';
}

const planPath = (certificationId: number) => `/api/certifications/${certificationId}`;

export const studyPlanApi = {
  plan: (certificationId: number) => requestJson<StudyPlan>(`${planPath(certificationId)}/plan`),
  today: () => requestJson<{ today: string; tasks: TodayTask[] }>('/api/study-tasks/today'),
  createStage: (certificationId: number, input: StageInput) =>
    requestJson<{ stage: StudyStage }>(`${planPath(certificationId)}/stages`, {
      method: 'POST',
      body: input,
    }),
  updateStage: (id: number, input: StageInput) =>
    requestJson<{ stage: Omit<StudyStage, 'tasks'> }>(`/api/study-stages/${id}`, {
      method: 'PUT',
      body: input,
    }),
  removeStage: (id: number) =>
    requestJson<undefined>(`/api/study-stages/${id}`, { method: 'DELETE' }),
  createTask: (stageId: number, input: TaskInput) =>
    requestJson<{ task: StudyTask }>(`/api/study-stages/${stageId}/tasks`, {
      method: 'POST',
      body: input,
    }),
  updateTask: (id: number, input: TaskInput) =>
    requestJson<{ task: StudyTask }>(`/api/study-tasks/${id}`, { method: 'PUT', body: input }),
  setCompleted: (id: number, completed: boolean) =>
    requestJson<{ task: StudyTask }>(`/api/study-tasks/${id}/completion`, {
      method: 'PATCH',
      body: { completed },
    }),
  removeTask: (id: number) =>
    requestJson<undefined>(`/api/study-tasks/${id}`, { method: 'DELETE' }),
};
