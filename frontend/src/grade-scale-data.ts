import { requestJson } from './lib/api';

// Grade scales (#51): API call and rules. The list itself comes from the server (backend/src/grade-scales.ts).

export type GradeLevel = {
  value: string;
  minScore: number | null;
  maxScore: number | null;
  offLadder?: boolean;
};

export type GradeScale = {
  key: string;
  label: string;
  note: string;
  sourceUrl: string;
  ranked: boolean;
  /** From the lowest to the highest. */
  levels: GradeLevel[];
};

/** The levels whose score range holds the score; several when a range is shared (IM1~IM3). */
export const gradesForScore = (scale: GradeScale, score: number) =>
  scale.levels.filter(
    (level) =>
      level.minScore !== null &&
      level.maxScore !== null &&
      score >= level.minScore &&
      score <= level.maxScore,
  );

/** Whether the result meets the target: the same level, or a higher one on a scale with steps. */
export function reachedGrade(
  scale: GradeScale | undefined,
  grade: string | null,
  target: string | null,
) {
  if (!grade || !target) return false;
  if (grade === target) return true;
  if (!scale?.ranked) return false;
  const position = (value: string) => scale.levels.findIndex((level) => level.value === value);
  const [reached, wanted] = [position(grade), position(target)];
  if (reached < 0 || wanted < 0) return false;
  if (scale.levels[reached]?.offLadder || scale.levels[wanted]?.offLadder) return false;
  return reached >= wanted;
}

export function scoreRange(level: GradeLevel) {
  if (level.minScore === null || level.maxScore === null) return '';
  return level.minScore === level.maxScore
    ? `${level.minScore}점`
    : `${level.minScore}~${level.maxScore}점`;
}

export const gradeScaleApi = {
  list: () => requestJson<{ scales: GradeScale[] }>('/api/grade-scales'),
};
