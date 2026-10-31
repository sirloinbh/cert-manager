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
    label: '토익 (CEFR 기준)',
    note: '토익에는 공식 등급이 없어 ETS의 CEFR 대응 점수(듣기+읽기 합계)를 씁니다. ETS는 이 값을 엄격한 합격선으로 쓰지 말라고 안내합니다.',
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
    label: '토익 스피킹',
    note: 'IM은 110~130점 안에서 IM1·IM2·IM3로 나뉩니다. 점수별 구간을 공식 자료에서 확인하지 못해 성적표의 등급을 직접 고릅니다.',
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
    label: '국가기술자격 (정보처리)',
    note: '정보처리 분야에 있는 단계만 넣었습니다. 기능사는 2026년부터 프로그래밍기능사로 이름이 바뀌었습니다.',
    sourceUrl: 'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=1320',
    ranked: true,
    levels: [named('기능사'), named('산업기사'), named('기사'), named('기술사')],
  },
  {
    key: 'aws',
    label: 'AWS 자격증',
    note: 'Specialty는 단계가 아니라 별도 분야입니다.',
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
    label: '운전면허 종류',
    note: '단계가 아니라 면허 종류입니다. 1종 특수는 대형견인차·소형견인차·구난차로 나뉩니다.',
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
