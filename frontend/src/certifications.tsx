import { ArrowLeft, Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  categories,
  categoryLabels,
  type Certification,
  certificationApi,
  type CertificationInput,
  type CertificationPaths,
  examCountdown,
  groupByCategory,
  statuses,
  statusLabels,
  upcomingExams,
  validityKinds,
  validityLabels,
  validityText,
} from './certification-data';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { Spinner } from './components/ui/spinner';
import { ExamAttempts } from './exam-attempts';
import { controlClass, toNumber } from './form-fields';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import { cn } from './lib/utils';
import { StudyPlan } from './study-plan';
import { useGradeScales } from './use-grade-scales';
import { useLoad } from './use-load';

// Screens for certification goals (#30). API calls and display rules are in certification-data.ts;
// page addresses come from app.tsx `pages`.

const loadList = () => certificationApi.list();
const loadOne = (id: string) => certificationApi.get(Number(id));

const statusVariant: Record<
  Certification['status'],
  'default' | 'secondary' | 'outline' | 'success' | 'destructive'
> = {
  planned: 'outline',
  studying: 'secondary',
  registered: 'default',
  taken: 'secondary',
  passed: 'success',
  failed: 'destructive',
};

function StatusBadge({ status }: { status: Certification['status'] }) {
  return <Badge variant={statusVariant[status]}>{statusLabels[status]}</Badge>;
}

function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 id="page-title" className="break-keep">
          {title}
        </h1>
        {description ? (
          <p className="text-body break-keep text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-9 w-fit items-center gap-1 rounded-md text-body-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

function goalSummary(item: Certification) {
  const grade = item.targetGrade ? `목표 등급 ${item.targetGrade}` : '';
  return [item.issuer, item.goalText, grade].filter(Boolean).join(' · ');
}

function ExamDate({ item }: { item: Certification }) {
  if (item.targetExamDate === null)
    return <span className="text-muted-foreground">시험일 미정</span>;
  return (
    <>
      <time dateTime={item.targetExamDate}>{item.targetExamDate}</time>
      {' · '}
      <strong
        className={cn('font-medium', (item.daysUntilExam ?? 0) < 0 && 'text-muted-foreground')}
      >
        {examCountdown(item.daysUntilExam)}
      </strong>
    </>
  );
}

export function CertificationList({ paths }: { paths: CertificationPaths }) {
  const loaded = useLoad('all', loadList);
  const addButton = (
    <Button asChild>
      <Link to={paths.create}>
        <Plus aria-hidden />
        목표 추가
      </Link>
    </Button>
  );
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <PageHeader
        title="자격증"
        description="따고 싶은 자격증과 목표 시험일을 분류별로 봅니다."
        actions={addButton}
      />
      {loaded.state === 'loading' ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{
            kind: 'error',
            text: errorText(loaded.error, '목표 목록을 불러오지 못했습니다'),
          }}
        />
      ) : null}
      {loaded.state === 'ok' && loaded.data.certifications.length === 0 ? (
        <EmptyState
          icon={<Award />}
          title="아직 목표 자격증이 없습니다"
          description="따고 싶은 자격증을 추가하면 분류별로 묶어 목표 시험일 순으로 보여 줍니다."
          action={addButton}
        />
      ) : null}
      {loaded.state === 'ok'
        ? groupByCategory(loaded.data.certifications).map(({ category, items }) => (
            <section
              key={category}
              aria-labelledby={`category-${category}`}
              className="flex flex-col gap-3"
            >
              <h2 id={`category-${category}`} className="flex items-baseline gap-2">
                {categoryLabels[category]}
                <span className="text-body-sm font-normal text-muted-foreground">
                  {items.length}개
                </span>
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="text-body font-semibold break-keep">
                          <Link
                            to={paths.detail(item.id)}
                            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            {item.name}
                          </Link>
                        </h3>
                        {goalSummary(item) ? (
                          <p className="text-body-sm break-keep text-muted-foreground">
                            {goalSummary(item)}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-body-sm">
                      <ExamDate item={item} />
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}
    </section>
  );
}

/** Dashboard card: the nearest target exams that are still ahead. */
export function UpcomingExams({ paths }: { paths: CertificationPaths }) {
  const loaded = useLoad('all', loadList);
  const exams = loaded.state === 'ok' ? upcomingExams(loaded.data.certifications) : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          가까운 시험
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loaded.state === 'loading' ? <SkeletonList rows={2} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(loaded.error, '목표 시험을 불러오지 못했습니다'),
            }}
          />
        ) : null}
        {loaded.state === 'ok' && exams.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            다가오는 시험이 없습니다. 자격증 목표에 시험일을 정하면 여기에 보입니다.
          </p>
        ) : null}
        {exams.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {exams.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <Link
                    to={paths.detail(item.id)}
                    className="truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {item.name}
                  </Link>
                  <time
                    dateTime={item.targetExamDate ?? undefined}
                    className="text-caption text-muted-foreground"
                  >
                    {item.targetExamDate}
                  </time>
                </div>
                <strong className="shrink-0 text-body-sm font-semibold">
                  {examCountdown(item.daysUntilExam)}
                </strong>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          to={paths.list}
          className="w-fit text-body-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          자격증 목표 전체 보기
        </Link>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd className="text-body break-keep whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function notFoundText(error: unknown) {
  return error instanceof RequestError && error.status === 404
    ? '자격증 목표를 찾을 수 없습니다. 이미 지웠을 수 있습니다.'
    : errorText(error, '자격증 목표를 불러오지 못했습니다');
}

export function CertificationDetail({ paths }: { paths: CertificationPaths }) {
  const { id = '' } = useParams();
  const loaded = useLoad(id, loadOne);
  const { scales, failed: scalesFailed } = useGradeScales();
  const navigate = useNavigate();
  // The goal as last saved from this page, so the status changes without reloading the attempts below.
  const [changed, setChanged] = useState<Certification>();

  if (loaded.state !== 'ok') {
    return (
      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        <BackLink to={paths.list}>자격증 목록</BackLink>
        <PageHeader title="자격증 목표" />
        {loaded.state === 'loading' ? (
          <SkeletonList rows={4} />
        ) : (
          <Notice notice={{ kind: 'error', text: notFoundText(loaded.error) }} />
        )}
      </section>
    );
  }

  const item = changed?.id === loaded.data.certification.id ? changed : loaded.data.certification;
  const gradeScale = scales.find((scale) => scale.key === item.gradeScale);
  const markPassed = async () => {
    try {
      const { certification } = await certificationApi.update(item.id, {
        ...toInput(toForm(item)),
        status: 'passed',
      });
      setChanged(certification);
      toast.success('목표 상태를 합격으로 바꿨습니다');
    } catch (error) {
      // The open dialog covers the page, so the reason goes in a toast above it.
      toast.error(errorText(error, '목표 상태를 바꾸지 못했습니다'));
      throw error;
    }
  };
  const remove = async () => {
    try {
      await certificationApi.remove(item.id);
    } catch (error) {
      // Already gone counts as deleted; anything else keeps the dialog open with the reason.
      if (!(error instanceof RequestError && error.status === 404)) {
        // The open dialog covers the page, so the reason goes in a toast above it.
        toast.error(errorText(error, '목표를 지우지 못했습니다'));
        throw error;
      }
    }
    toast.success(`'${item.name}' 목표를 지웠습니다`);
    void navigate(paths.list);
  };

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list}>자격증 목록</BackLink>
      <PageHeader
        title={item.name}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={paths.edit(item.id)}>
                <Pencil aria-hidden />
                수정
              </Link>
            </Button>
            <ConfirmDialog
              title="목표를 지울까요?"
              description={
                <span className="break-keep">
                  {`'${item.name}' 목표를 지웁니다. 이 목표에 딸린 응시 기록과 공부 계획도 함께 지워지고 되돌릴 수 없습니다.`}
                </span>
              }
              onConfirm={remove}
              trigger={
                <Button variant="outline" className="text-destructive">
                  <Trash2 aria-hidden />
                  삭제
                </Button>
              }
            />
          </>
        }
      />
      <dl className="rounded-xl border bg-card px-4 text-card-foreground shadow-sm">
        <Field label="분류" value={categoryLabels[item.category]} />
        <Field label="상태" value={<StatusBadge status={item.status} />} />
        <Field
          label="주관 기관"
          value={item.issuer || <span className="text-muted-foreground">적지 않음</span>}
        />
        <Field
          label="목표"
          value={item.goalText || <span className="text-muted-foreground">적지 않음</span>}
        />
        <Field
          label="목표 점수"
          value={
            item.targetScore === null ? (
              <span className="text-muted-foreground">정하지 않음</span>
            ) : (
              `${item.targetScore}점`
            )
          }
        />
        {item.gradeScale === 'none' ? null : (
          <Field
            label="목표 등급"
            value={item.targetGrade ?? <span className="text-muted-foreground">미정</span>}
          />
        )}
        <Field label="목표 시험일" value={<ExamDate item={item} />} />
        <Field label="유효기간" value={validityText(item)} />
        <Field
          label="메모"
          value={item.memo || <span className="text-muted-foreground">없음</span>}
        />
      </dl>
      {scalesFailed && item.gradeScale !== 'none' ? (
        <Notice
          notice={{
            kind: 'error',
            text: '등급 목록을 불러오지 못해 등급표를 보여 줄 수 없습니다. 목표보다 높은 등급의 달성 표시도 지금은 나오지 않지만, 목표 등급과 기록은 그대로입니다.',
          }}
        />
      ) : null}
      <ExamAttempts
        key={item.id}
        certification={item}
        gradeScale={gradeScale}
        onMarkPassed={markPassed}
      />
      <StudyPlan key={`plan-${item.id}`} certification={item} />
    </section>
  );
}

type FormState = {
  name: string;
  category: Certification['category'];
  issuer: string;
  status: Certification['status'];
  goalText: string;
  targetScore: string;
  targetExamDate: string;
  validityKind: Certification['validityKind'];
  validityMonths: string;
  memo: string;
  gradeScale: string;
  targetGrade: string;
};

const emptyForm: FormState = {
  name: '',
  category: 'english',
  issuer: '',
  status: 'planned',
  goalText: '',
  targetScore: '',
  targetExamDate: '',
  validityKind: 'unknown',
  validityMonths: '',
  memo: '',
  gradeScale: 'none',
  targetGrade: '',
};

function toForm(item: Certification): FormState {
  return {
    name: item.name,
    category: item.category,
    issuer: item.issuer,
    status: item.status,
    goalText: item.goalText,
    validityKind: item.validityKind,
    memo: item.memo,
    targetScore: item.targetScore === null ? '' : String(item.targetScore),
    targetExamDate: item.targetExamDate ?? '',
    validityMonths: item.validityMonths === null ? '' : String(item.validityMonths),
    gradeScale: item.gradeScale,
    targetGrade: item.targetGrade ?? '',
  };
}

function toInput(form: FormState): CertificationInput {
  return {
    ...form,
    targetScore: toNumber(form.targetScore),
    targetExamDate: form.targetExamDate === '' ? null : form.targetExamDate,
    validityMonths: form.validityKind === 'months' ? toNumber(form.validityMonths) : null,
    targetGrade: form.targetGrade === '' ? null : form.targetGrade,
  };
}

function FormFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: FormState;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (input: CertificationInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const notice = useNotice();
  const id = useId();
  const { scales, failed } = useGradeScales();
  const scale = scales.find((item) => item.key === form.gradeScale);
  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    notice.clear();
    onSubmit(toInput(form)).catch((error: unknown) => {
      notice.error(error, '저장하지 못했습니다');
      setPending(false);
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>자격증 이름</Label>
        <Input
          id={`${id}-name`}
          required
          maxLength={200}
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="예: 토익"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-category`}>분류</Label>
          <select
            id={`${id}-category`}
            className={cn(controlClass, 'h-9')}
            value={form.category}
            onChange={(e) => set('category')(e.target.value as FormState['category'])}
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {categoryLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-status`}>상태</Label>
          <select
            id={`${id}-status`}
            className={cn(controlClass, 'h-9')}
            value={form.status}
            onChange={(e) => set('status')(e.target.value as FormState['status'])}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-issuer`}>주관 기관</Label>
        <Input
          id={`${id}-issuer`}
          maxLength={200}
          value={form.issuer}
          onChange={(e) => set('issuer')(e.target.value)}
          placeholder="예: YBM, 한국산업인력공단, AWS"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-goal`}>목표</Label>
          <Input
            id={`${id}-goal`}
            maxLength={200}
            value={form.goalText}
            onChange={(e) => set('goalText')(e.target.value)}
            placeholder="예: 900점 이상, 합격"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-score`}>목표 점수</Label>
          <Input
            id={`${id}-score`}
            type="number"
            inputMode="numeric"
            min={0}
            value={form.targetScore}
            onChange={(e) => set('targetScore')(e.target.value)}
            aria-describedby={`${id}-score-hint`}
          />
          <p id={`${id}-score-hint`} className="text-caption text-muted-foreground">
            점수가 없는 시험이면 비워 둡니다.
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-scale`}>등급 체계</Label>
          <select
            id={`${id}-scale`}
            className={cn(controlClass, 'h-9')}
            // Until the list arrives the saved choice stays as it is, so saving cannot change it.
            disabled={scales.length === 0}
            aria-describedby={`${id}-scale-hint`}
            value={form.gradeScale}
            onChange={(e) =>
              setForm((current) => ({ ...current, gradeScale: e.target.value, targetGrade: '' }))
            }
          >
            <option value="none">쓰지 않음</option>
            {scales.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
            {scales.length === 0 && form.gradeScale !== 'none' ? (
              <option value={form.gradeScale}>저장된 등급 체계</option>
            ) : null}
          </select>
          <p id={`${id}-scale-hint`} className="text-caption break-keep text-muted-foreground">
            {failed
              ? '등급 목록을 불러오지 못해 지금은 고를 수 없습니다. 이미 고른 값은 그대로 저장됩니다.'
              : scales.length === 0
                ? '등급 목록을 불러오는 중입니다.'
                : (scale?.note ?? '점수·레벨·단계가 있는 자격증이면 고릅니다.')}
          </p>
        </div>
        {scale ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-target-grade`}>목표 등급</Label>
            <select
              id={`${id}-target-grade`}
              className={cn(controlClass, 'h-9')}
              value={form.targetGrade}
              onChange={(e) => set('targetGrade')(e.target.value)}
            >
              <option value="">미정</option>
              {[...scale.levels].reverse().map((level) => (
                <option key={level.value} value={level.value}>
                  {level.value}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-date`}>목표 시험일</Label>
        <Input
          id={`${id}-date`}
          type="date"
          className="sm:max-w-60"
          value={form.targetExamDate}
          onChange={(e) => set('targetExamDate')(e.target.value)}
          aria-describedby={`${id}-date-hint`}
        />
        <p id={`${id}-date-hint`} className="text-caption text-muted-foreground">
          아직 정하지 않았으면 비워 둡니다.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-validity`}>유효기간</Label>
          <select
            id={`${id}-validity`}
            className={cn(controlClass, 'h-9')}
            value={form.validityKind}
            onChange={(e) => set('validityKind')(e.target.value as FormState['validityKind'])}
          >
            {validityKinds.map((value) => (
              <option key={value} value={value}>
                {validityLabels[value]}
              </option>
            ))}
          </select>
        </div>
        {form.validityKind === 'months' ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-months`}>유효기간 개월 수</Label>
            <Input
              id={`${id}-months`}
              type="number"
              inputMode="numeric"
              min={1}
              required
              value={form.validityMonths}
              onChange={(e) => set('validityMonths')(e.target.value)}
              placeholder="예: 24"
            />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-memo`}>메모</Label>
        <textarea
          id={`${id}-memo`}
          rows={4}
          className={cn(controlClass, 'min-h-24 py-2')}
          value={form.memo}
          onChange={(e) => set('memo')(e.target.value)}
          placeholder="접수 기간, 준비물 등"
        />
      </div>
      <Notice notice={notice.notice} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          {submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>취소</Link>
        </Button>
      </div>
    </form>
  );
}

export function NewCertification({ paths }: { paths: CertificationPaths }) {
  const navigate = useNavigate();
  const create = async (input: CertificationInput) => {
    const { certification } = await certificationApi.create(input);
    toast.success(`'${certification.name}' 목표를 추가했습니다`);
    void navigate(paths.detail(certification.id));
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list}>자격증 목록</BackLink>
      <PageHeader
        title="목표 추가"
        description="따고 싶은 자격증과 목표를 적습니다. 이름과 분류만 있으면 됩니다."
      />
      <FormFields initial={emptyForm} submitLabel="추가" cancelTo={paths.list} onSubmit={create} />
    </section>
  );
}

export function EditCertification({ paths }: { paths: CertificationPaths }) {
  const { id = '' } = useParams();
  const loaded = useLoad(id, loadOne);
  const navigate = useNavigate();
  const update = async (input: CertificationInput) => {
    const { certification } = await certificationApi.update(Number(id), input);
    toast.success('저장했습니다');
    void navigate(paths.detail(certification.id));
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink
        to={loaded.state === 'ok' ? paths.detail(loaded.data.certification.id) : paths.list}
      >
        {loaded.state === 'ok' ? loaded.data.certification.name : '자격증 목록'}
      </BackLink>
      <PageHeader title="목표 수정" />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice notice={{ kind: 'error', text: notFoundText(loaded.error) }} />
      ) : null}
      {loaded.state === 'ok' ? (
        <FormFields
          initial={toForm(loaded.data.certification)}
          submitLabel="저장"
          cancelTo={paths.detail(loaded.data.certification.id)}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
