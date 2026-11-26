// The API's operation table. The document is built by the managed standard/openapi.ts from Zod schemas
// (z.toJSONSchema). `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date or
// when the table and the registered routes differ.
import { z } from 'zod/v4';

import { exportTables } from './data-transfer.js';
import { certificationInput, certificationStatusInput } from './routes/certifications.js';
import { learnedInput } from './routes/daily-words.js';
import { attemptInput } from './routes/exam-attempts.js';
import { lyricsInput, translationInput } from './routes/songs.js';
import {
  completionInput as taskCompletionInput,
  rangeQuery,
  stageInput,
  taskInput,
} from './routes/study-plans.js';
import { actionInput, completionInput as actionCompletionInput } from './routes/user-actions.js';
import { buildOpenApi, type Operation } from './standard/openapi.js';
import { dayQuery } from './validation.js';

// Every registered route must appear here exactly once (checked when building).
// Every route that reads an id, a body or a query also answers 400 when validation fails.
const routes: Record<string, Operation> = {
  'GET /api/health': {
    summary: 'Check the server and database connection',
    status: [200, 500],
    public: true,
  },
  'GET /api/me': { summary: 'Get the signed-in user', status: [200, 401, 503] },

  'GET /api/grade-scales': { summary: 'List the grade scales a goal can use', status: [200] },
  'GET /api/certifications': {
    summary: 'List certification goals, grouped by category and nearest exam date first',
    status: [200],
  },
  'GET /api/certifications/:id': {
    summary: 'Get one certification goal',
    status: [200, 400, 404],
  },
  'POST /api/certifications': {
    summary: 'Add a certification goal; a validity type of months needs the validity months',
    body: ['Certification', certificationInput],
    status: [201, 400],
  },
  'PUT /api/certifications/:id': {
    summary: 'Replace a certification goal; the same cross-field rules as adding apply',
    body: ['Certification', certificationInput],
    status: [200, 400, 404],
  },
  'PATCH /api/certifications/:id/status': {
    summary: 'Change only the status of a certification goal; other fields stay as stored',
    body: ['CertificationStatus', certificationStatusInput],
    status: [200, 400, 404],
  },
  'DELETE /api/certifications/:id': {
    summary: 'Delete a certification goal',
    status: [204, 400, 404],
  },

  'GET /api/exam-attempts/latest': {
    summary: 'Get the latest exam attempt of each goal, with its expiry',
    status: [200],
  },
  'GET /api/certifications/:id/attempts': {
    summary: 'List the exam attempts of a goal',
    status: [200, 400, 404],
  },
  'POST /api/certifications/:id/attempts': {
    summary:
      'Add an exam attempt; a pending outcome takes no score or grade, and a left-out expiry date asks for the goal default',
    body: ['ExamAttempt', attemptInput],
    status: [201, 400, 404],
  },
  'PUT /api/certifications/:id/attempts/:attemptId': {
    summary: 'Replace an exam attempt; the same cross-field rules as adding apply',
    body: ['ExamAttempt', attemptInput],
    status: [200, 400, 404],
  },
  'DELETE /api/certifications/:id/attempts/:attemptId': {
    summary: 'Delete an exam attempt',
    status: [204, 400, 404],
  },

  'GET /api/certifications/:id/plan': {
    summary: 'Get the study plan of a goal: its stages with their tasks',
    status: [200, 400, 404],
  },
  'GET /api/study-tasks/today': {
    summary: 'List the open study tasks due today or earlier',
    status: [200],
  },
  'GET /api/study-tasks': {
    summary: 'List the study tasks due from one day to another, both included (at most 366 days)',
    query: rangeQuery,
    status: [200, 400],
  },
  'GET /api/study-tasks/progress': {
    summary: 'List the goals that have study tasks with how many tasks are done and in all',
    status: [200],
  },
  'POST /api/certifications/:id/stages': {
    summary: 'Add a study stage to a goal, last among its stages',
    body: ['StudyStage', stageInput],
    status: [201, 400, 404],
  },
  'PUT /api/study-stages/:id': {
    summary: 'Replace a study stage; the end date must not be before the start date',
    body: ['StudyStage', stageInput],
    status: [200, 400, 404],
  },
  'DELETE /api/study-stages/:id': {
    summary: 'Delete a study stage with its tasks',
    status: [204, 400, 404],
  },
  'POST /api/study-stages/:id/tasks': {
    summary: 'Add a task to a study stage',
    body: ['StudyTask', taskInput],
    status: [201, 400, 404],
  },
  'PUT /api/study-tasks/:id': {
    summary: 'Replace a study task',
    body: ['StudyTask', taskInput],
    status: [200, 400, 404],
  },
  'PATCH /api/study-tasks/:id/completion': {
    summary: 'Mark a study task completed or open again',
    body: ['StudyTaskCompletion', taskCompletionInput],
    status: [200, 400, 404],
  },
  'DELETE /api/study-tasks/:id': { summary: 'Delete a study task', status: [204, 400, 404] },

  'GET /api/user-actions': {
    summary: 'List the custom tasks shown as alerts',
    status: [200],
  },
  'POST /api/user-actions': {
    summary:
      'Add a custom task; the due date must not be before the reminder start date and a link must be http or https',
    body: ['UserAction', actionInput],
    status: [201, 400],
  },
  'PUT /api/user-actions/:id/completion': {
    summary: 'Mark a custom task completed or open again',
    body: ['UserActionCompletion', actionCompletionInput],
    status: [200, 400, 404],
  },
  'DELETE /api/user-actions/:id': { summary: 'Delete a custom task', status: [204, 400, 404] },

  'GET /api/songs': { summary: 'List songs with their translation status', status: [200] },
  'GET /api/songs/:id': { summary: 'Get one song with its lyric lines', status: [200, 400, 404] },
  'PUT /api/songs/:id/lyrics': {
    summary: 'Replace the original lyrics of a song; translations of unchanged lines are kept',
    body: ['SongLyrics', lyricsInput],
    status: [200, 400, 404],
  },
  'PUT /api/songs/:id/translation': {
    summary:
      'Save the translation of a song; its non-blank line count must equal the original lyric lines',
    body: ['SongTranslation', translationInput],
    status: [200, 400, 404],
  },

  'GET /api/words': { summary: 'List words', status: [200] },
  'GET /api/words/:id': { summary: 'Get one word', status: [200, 400, 404] },
  'GET /api/daily-words': {
    summary:
      'Get the words saved for a day (today by default); read only, a day with no words answers an empty list',
    query: dayQuery,
    status: [200, 400],
  },
  'POST /api/daily-words': {
    summary: "Choose today's words if they are not chosen yet and answer them; safe to repeat",
    status: [200],
  },
  'PUT /api/words/:id/learned': {
    summary: 'Mark a word learned or not learned',
    body: ['WordLearned', learnedInput],
    status: [200, 400, 404],
  },

  'GET /api/data-transfer/export': {
    summary:
      'Download all personal data as one JSON file (version, export time, and the certifications, exam attempts, study stages, study tasks and custom tasks); words and songs are left out',
    status: [200],
  },
  'GET /api/data-transfer/export/:table': {
    summary:
      'Download one table of the export as a CSV file for a spreadsheet; the table is certifications, examAttempts, studyStages, studyTasks or userActions',
    params: { table: z.enum(exportTables.map((table) => table.name) as [string, ...string[]]) },
    produces: 'text/csv',
    status: [200, 404],
  },
};

// #143: the shared sign-in can answer 503 (unavailable or not configured) on every guarded route; the builder adds 401.
export const operations: Record<string, Operation> = Object.fromEntries(
  Object.entries(routes).map(([route, op]) => [
    route,
    op.public || op.status.includes(503)
      ? op
      : { ...op, status: [...op.status, 503] as Operation['status'] },
  ]),
);

const statusText: Record<number, string> = {
  200: 'Success',
  201: 'Created',
  204: 'Success, no content',
  400: 'Input validation failed',
  401: 'Sign-in required (no session from the shared sign-in)',
  404: 'No target',
  500: 'Server error',
  503: 'The shared sign-in is unavailable or not configured',
};

export const document = buildOpenApi({
  title: 'Cert Manager API',
  description:
    'Dates are YYYY-MM-DD (Asia/Seoul). Every route can also answer 429 when the API rate limit is exceeded. Every error response is { error: English message }.',
  errorDescription: 'English error message',
  operations,
  statusText,
});
