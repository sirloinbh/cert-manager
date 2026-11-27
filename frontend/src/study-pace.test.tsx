import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { Certification } from './certification-data';
import { StudyPaceMessage } from './study-pace';
import type { StudyStage, StudyTask } from './study-plan-data';

const certification = (fields: Partial<Certification> = {}): Certification => ({
  id: 4,
  name: 'TOEIC',
  category: 'english',
  issuer: '',
  status: 'studying',
  goalText: '',
  targetScore: null,
  targetExamDate: '2026-12-02',
  daysUntilExam: 5,
  validityKind: 'unknown',
  validityMonths: null,
  memo: '',
  gradeScale: 'none',
  targetGrade: null,
  ...fields,
});

const finished = '2026-11-26T01:00:00.000Z';
const task = (id: number, fields: Partial<StudyTask> = {}): StudyTask => ({
  id,
  stageId: 1,
  title: `Task ${id}`,
  position: id,
  dueDate: null,
  daysUntilDue: null,
  completedAt: null,
  ...fields,
});

const plan = (tasks: StudyTask[], startDate: string | null = null): StudyStage[] => [
  { id: 1, certificationId: 4, title: 'Stage', position: 1, startDate, endDate: null, tasks },
];

test('shows the tasks to finish each day', () => {
  const tasks = [task(1), task(2), task(3), task(4, { completedAt: finished })];
  render(<StudyPaceMessage certification={certification()} stages={plan(tasks)} />);
  expect(screen.getByTestId('study-pace')).toHaveTextContent(
    '1 task a day · 3 tasks open, 5 days left',
  );
  expect(screen.queryByText('Behind plan')).not.toBeInTheDocument();
});

test('says behind plan when an open task is past its due date', () => {
  const tasks = [task(1, { dueDate: '2026-11-25', daysUntilDue: -2 }), task(2)];
  render(<StudyPaceMessage certification={certification()} stages={plan(tasks)} />);
  expect(screen.getByText('Behind plan')).toBeInTheDocument();
  expect(screen.getByTestId('study-pace')).toHaveTextContent('1 task a day · 2 tasks open');
});

test('says behind plan when more tasks are open than the plan expected', () => {
  const tasks = [task(1), task(2), task(3), task(4, { completedAt: finished })];
  render(<StudyPaceMessage certification={certification()} stages={plan(tasks, '2026-11-22')} />);
  expect(screen.getByText('Behind plan')).toBeInTheDocument();
});

test('shows nothing when the exam date is not set or the plan has not loaded', () => {
  const noDate = certification({ targetExamDate: null, daysUntilExam: null });
  const { rerender } = render(<StudyPaceMessage certification={noDate} stages={plan([task(1)])} />);
  expect(screen.queryByTestId('study-pace')).not.toBeInTheDocument();
  rerender(<StudyPaceMessage certification={certification()} stages={undefined} />);
  expect(screen.queryByTestId('study-pace')).not.toBeInTheDocument();
});
