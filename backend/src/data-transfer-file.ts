import { z } from 'zod/v4';

import { exportVersion } from './data-transfer.js';
import { certificationInput } from './routes/certifications.js';
import { attemptInput } from './routes/exam-attempts.js';
import { stageInput, taskInput } from './routes/study-plans.js';
import { actionInput } from './routes/user-actions.js';

// The export file as the import reads it (#211). Every row is checked with the same rules as the matching
// API input, so a file can never hold a row the app itself would refuse. The checks run before the database
// is touched; a bad file is a 400 and changes nothing.

const id = z
  .number({ error: 'ID must be a number' })
  .int('ID must be a whole number')
  .positive('ID must be 1 or more');
const stamp = (label: string) =>
  z.iso.datetime({ error: `${label} must be an ISO 8601 date and time` });
const row = { id, createdAt: stamp('Created time'), updatedAt: stamp('Updated time') };
const completedAt = stamp('Completed time').nullable();
const position = z
  .number({ error: 'Position must be a number' })
  .int('Position must be a whole number')
  .positive('Position must be 1 or more');

const certification = certificationInput.safeExtend(row);
const examAttempt = attemptInput.safeExtend({
  ...row,
  certificationId: id,
  // The export always writes the expiry day or null, never leaves it out.
  expiresOn: attemptInput.shape.expiresOn.unwrap().nullable(),
});
const studyStage = stageInput.safeExtend({ ...row, certificationId: id, position });
const studyTask = taskInput.safeExtend({ ...row, stageId: id, position, completedAt });
const userAction = actionInput.safeExtend({ ...row, completedAt });

export type ImportFile = z.infer<typeof importFile>;

export const importFile = z
  .object(
    {
      version: z.literal(exportVersion, {
        error: `This file has an unsupported version; this app reads version ${exportVersion}`,
      }),
      exportedAt: stamp('Export time'),
      tables: z.object(
        {
          certifications: z.array(certification, { error: 'Certifications must be a list' }),
          examAttempts: z.array(examAttempt, { error: 'Exam attempts must be a list' }),
          studyStages: z.array(studyStage, { error: 'Study stages must be a list' }),
          studyTasks: z.array(studyTask, { error: 'Study tasks must be a list' }),
          userActions: z.array(userAction, { error: 'Custom tasks must be a list' }),
        },
        { error: 'The file has no tables' },
      ),
    },
    { error: 'The file must be a JSON object' },
  )
  .superRefine(({ tables }, ctx) => {
    const problem = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path: ['tables', ...path], message });
    const ids = (name: keyof typeof tables) => new Set(tables[name].map((item) => item.id));
    for (const name of Object.keys(tables) as (keyof typeof tables)[]) {
      const seen = new Set<number>();
      tables[name].forEach((item, index) => {
        if (seen.has(item.id)) problem([name, index, 'id'], 'This ID appears twice in the file');
        seen.add(item.id);
      });
    }
    const goals = ids('certifications');
    const stages = ids('studyStages');
    tables.examAttempts.forEach((item, index) => {
      if (!goals.has(item.certificationId))
        problem(
          ['examAttempts', index, 'certificationId'],
          'This exam attempt points to a certification that is not in the file',
        );
    });
    tables.studyStages.forEach((item, index) => {
      if (!goals.has(item.certificationId))
        problem(
          ['studyStages', index, 'certificationId'],
          'This study stage points to a certification that is not in the file',
        );
    });
    tables.studyTasks.forEach((item, index) => {
      if (!stages.has(item.stageId))
        problem(
          ['studyTasks', index, 'stageId'],
          'This study task points to a study stage that is not in the file',
        );
    });
    const positions = (
      list: { position: number }[],
      parent: (item: never) => number,
      name: string,
    ) => {
      const seen = new Set<string>();
      (list as never[]).forEach((item, index) => {
        const key = `${parent(item)}:${(item as { position: number }).position}`;
        if (seen.has(key))
          problem([name, index, 'position'], 'This position is used twice under the same parent');
        seen.add(key);
      });
    };
    positions(
      tables.studyStages,
      (item: { certificationId: number }) => item.certificationId,
      'studyStages',
    );
    positions(tables.studyTasks, (item: { stageId: number }) => item.stageId, 'studyTasks');
  });
