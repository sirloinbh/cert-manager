// Grade scales a goal can use (#51). Sources and the date they were checked: docs/research/certification-grades.md.
// Levels run from the lowest to the highest. The frontend reads this list from GET /api/grade-scales.

type GradeLevel = {
  value: string;
  minScore: number | null;
  maxScore: number | null;
  /** A separate field rather than a step, so it is neither above nor below the others. */
  offLadder?: boolean;
};

type GradeScale = {
  key: string;
  label: string;
  note: string;
  sourceUrl: string;
  /** Whether a higher level also reaches a lower target. Kinds of licence only match themselves. */
  ranked: boolean;
  levels: GradeLevel[];
};

const named = (value: string, fields: Partial<GradeLevel> = {}): GradeLevel => ({
  value,
  minScore: null,
  maxScore: null,
  ...fields,
});

const scored = (value: string, minScore: number, maxScore: number): GradeLevel => ({
  value,
  minScore,
  maxScore,
});

export const gradeScales: GradeScale[] = [
  {
    key: 'toeic',
    label: 'TOEIC (CEFR mapping)',
    note: 'TOEIC has no official grades, so this uses the ETS CEFR mapping of the combined Listening and Reading score. ETS advises against treating these values as strict pass marks.',
    sourceUrl: 'https://www.ets.org/pdfs/toeic/toeic-mapping-cefr-reference.pdf',
    ranked: true,
    levels: [
      scored('A1', 120, 224),
      scored('A2', 225, 549),
      scored('B1', 550, 784),
      scored('B2', 785, 944),
      scored('C1', 945, 990),
    ],
  },
  {
    key: 'toeic_speaking',
    label: 'TOEIC Speaking',
    note: 'IM is split into IM1, IM2, and IM3 within 110 to 130 points. The score ranges for each could not be confirmed from official sources, so pick the grade shown on your score report.',
    sourceUrl: 'https://www.toeicstory.co.kr/2607',
    ranked: true,
    levels: [
      scored('NM/NL', 0, 50),
      scored('NH', 60, 80),
      scored('IL', 90, 100),
      scored('IM1', 110, 130),
      scored('IM2', 110, 130),
      scored('IM3', 110, 130),
      scored('IH', 140, 150),
      scored('AL', 160, 170),
      scored('AM', 180, 190),
      scored('AH', 200, 200),
    ],
  },
  {
    key: 'information_processing',
    label: 'National Technical Qualification (Information Processing)',
    note: 'Only the levels that exist in the Information Processing field are included. Starting in 2026, the Gineungsa level is renamed Programming Gineungsa.',
    sourceUrl: 'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=1320',
    ranked: true,
    levels: [named('기능사'), named('산업기사'), named('기사'), named('기술사')],
  },
  {
    key: 'aws',
    label: 'AWS certifications',
    note: 'Specialty is a separate field, not a level.',
    sourceUrl: 'https://aws.amazon.com/certification/',
    ranked: true,
    levels: [
      named('Foundational'),
      named('Associate'),
      named('Professional'),
      named('Specialty', { offLadder: true }),
    ],
  },
  {
    key: 'driver_license',
    label: 'Driver license types',
    note: 'These are license types, not levels. Class 1 Special covers large tow trucks, small tow trucks, and rescue vehicles.',
    sourceUrl: 'https://www.data.go.kr/biz/dcat/metadata/15160156.do',
    ranked: false,
    levels: [
      named('2종 원동기'),
      named('2종 소형'),
      named('2종 보통'),
      named('1종 소형'),
      named('1종 보통'),
      named('1종 대형'),
      named('1종 특수'),
    ],
  },
];

export const gradeScaleKeys = ['none', ...gradeScales.map((scale) => scale.key)] as [
  string,
  ...string[],
];

/** Whether the level belongs to the scale. */
export const hasLevel = (key: string, value: string) =>
  gradeScales.some(
    (scale) => scale.key === key && scale.levels.some((level) => level.value === value),
  );
