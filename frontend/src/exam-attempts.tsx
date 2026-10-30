import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, type MouseEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { Certification, CertificationPaths } from './certification-data';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { Spinner } from './components/ui/spinner';
import {
  addMonths,
  currentAttempt,
  type ExamAttempt,
  examAttemptApi,
  type ExamAttemptInput,
  expiringSoon,
  expiryCountdown,
  expiryLabels,
  type ExpiryState,
  expiryState,
  hasExpiry,
  type Outcome,
  outcomeLabels,
  outcomes,
  reachedGoal,
} from './exam-attempt-data';
import { controlClass, toNumber } from './form-fields';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import { cn } from './lib/utils';
import { useLoad } from './use-load';

// Screens for exam attempts (#32): the section on a goal's detail page and the dashboard card.

const outcomeVariant: Record<Outcome, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  waiting: 'outline',
  passed: 'success',
  failed: 'destructive',
  scored: 'secondary',
};

const expiryVariant: Record<ExpiryState, 'outline' | 'success' | 'warning' | 'destructive'> = {
  none: 'outline',
  unknown: 'outline',
  expired: 'destructive',
  soon: 'warning',
  valid: 'success',
};

function ExpiryBadge({ state }: { state: ExpiryState }) {
  return <Badge variant={expiryVariant[state]}>{expiryLabels[state]}</Badge>;
}

function ExpiryLine({ attempt, state }: { attempt: ExamAttempt; state: ExpiryState }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
      <ExpiryBadge state={state} />
      {attempt.expiresOn !== null && attempt.daysUntilExpiry !== null ? (
        <span>
          <time dateTime={attempt.expiresOn}>{attempt.expiresOn}</time>
          {' · '}
          {expiryCountdown(attempt.daysUntilExpiry)}
        </span>
      ) : null}
    </p>
  );
}

function resultText(attempt: ExamAttempt) {
  const score = attempt.score === null ? '' : `${attempt.score}점`;
  return [score, attempt.grade ?? ''].filter(Boolean).join(' · ');
}

// The API takes four-digit years only; the browser stops a later date before it is sent.
const lastDate = '9999-12-31';

type FormState = {
  examDate: string;
  outcome: Outcome;
  score: string;
  grade: string;
  expiresOn: string;
  memo: string;
};

function AttemptForm({
  certification,
  attempt,
  onSubmit,
}: {
  certification: Certification;
  attempt: ExamAttempt | null;
  onSubmit: (input: ExamAttemptInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormState>({
    examDate: attempt?.examDate ?? '',
    outcome: attempt?.outcome ?? 'waiting',
    score: attempt?.score === null || attempt === null ? '' : String(attempt.score),
    grade: attempt?.grade ?? '',
    expiresOn: attempt?.expiresOn ?? '',
    memo: attempt?.memo ?? '',
  });
  // A saved result keeps what the user decided, even an empty date ("not known"). Until then the date follows the exam.
  const [expiryEdited, setExpiryEdited] = useState(attempt !== null && hasExpiry(attempt.outcome));
  const [pending, setPending] = useState(false);
  const notice = useNotice();
  const id = useId();
  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((current) => ({ ...current, [key]: value }));

  const { validityKind, validityMonths } = certification;
  const months = validityKind === 'months' ? validityMonths : null;
  const prefilled = months !== null && form.examDate ? addMonths(form.examDate, months) : '';
  const expiresOn = expiryEdited ? form.expiresOn : prefilled;
  const showResult = form.outcome !== 'waiting';
  const showExpiry = hasExpiry(form.outcome) && validityKind !== 'none';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    notice.clear();
    onSubmit({
      examDate: form.examDate,
      outcome: form.outcome,
      score: showResult ? toNumber(form.score) : null,
      grade: showResult ? form.grade : null,
      expiresOn: showExpiry && expiresOn !== '' ? expiresOn : null,
      memo: form.memo,
    }).catch((error: unknown) => {
      notice.error(error, '저장하지 못했습니다');
      setPending(false);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending || undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>시험일</Label>
          <Input
            id={`${id}-date`}
            type="date"
            required
            max={lastDate}
            value={form.examDate}
            onChange={(e) => set('examDate')(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-outcome`}>결과</Label>
          <select
            id={`${id}-outcome`}
            className={cn(controlClass, 'h-9')}
            value={form.outcome}
            onChange={(e) => set('outcome')(e.target.value as Outcome)}
          >
            {outcomes.map((value) => (
              <option key={value} value={value}>
                {outcomeLabels[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showResult ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-score`}>점수</Label>
            <Input
              id={`${id}-score`}
              type="number"
              inputMode="numeric"
              min={0}
              value={form.score}
              onChange={(e) => set('score')(e.target.value)}
              aria-describedby={certification.targetScore === null ? undefined : `${id}-score-hint`}
            />
            {certification.targetScore === null ? null : (
              <p id={`${id}-score-hint`} className="text-caption text-muted-foreground">
                목표 점수는 {certification.targetScore}점입니다.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-grade`}>등급</Label>
            <Input
              id={`${id}-grade`}
              maxLength={200}
              value={form.grade}
              onChange={(e) => set('grade')(e.target.value)}
              placeholder="예: Level 7, IH"
            />
          </div>
        </div>
      ) : null}
      {showExpiry ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-expires`}>만료일</Label>
          <Input
            id={`${id}-expires`}
            type="date"
            className="sm:max-w-60"
            min={form.examDate || undefined}
            max={lastDate}
            value={expiresOn}
            onChange={(e) => {
              setExpiryEdited(true);
              set('expiresOn')(e.target.value);
            }}
            aria-describedby={`${id}-expires-hint`}
          />
          <p id={`${id}-expires-hint`} className="text-caption break-keep text-muted-foreground">
            {months === null
              ? '유효기간을 정하지 않은 목표입니다. 만료일을 모르면 비워 둡니다.'
              : '비우면 "만료일 모름"으로 저장합니다.'}
          </p>
          {prefilled !== '' && expiresOn !== prefilled ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto w-fit justify-start p-0 text-left break-keep whitespace-normal"
              onClick={() => setExpiryEdited(false)}
            >
              시험일에서 {months}개월 뒤({prefilled})로 채우기
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-memo`}>메모</Label>
        <textarea
          id={`${id}-memo`}
          rows={3}
          className={cn(controlClass, 'min-h-20 py-2')}
          value={form.memo}
          onChange={(e) => set('memo')(e.target.value)}
        />
      </div>
      <Notice notice={notice.notice} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            취소
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

const loadAttempts = (key: string) => examAttemptApi.list(Number(key.split('/')[0]));

/** The section on a goal's detail page. Marking the goal passed is left to the page that owns the goal. */
export function ExamAttempts({
  certification,
  onMarkPassed,
}: {
  certification: Certification;
  onMarkPassed: () => Promise<unknown>;
}) {
  // A new version reloads the list after a change.
  const [version, setVersion] = useState(0);
  const loaded = useLoad(`${certification.id}/${version}`, loadAttempts);
  // The attempt stays while the dialog closes, so its title and form do not change as it fades out.
  const [editing, setEditing] = useState<{ open: boolean; attempt: ExamAttempt | null }>({
    open: false,
    attempt: null,
  });
  const [saving, setSaving] = useState(false);
  const [askPassed, setAskPassed] = useState(false);
  const titleId = useId();
  // The dialog has no trigger of its own, so it is told where focus goes back to.
  const opener = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const openForm = (event: MouseEvent<HTMLElement>, attempt: ExamAttempt | null) => {
    opener.current = event.currentTarget;
    setEditing({ open: true, attempt });
  };
  // The last list stays on screen while a change reloads it, and when that reload fails.
  const [shown, setShown] = useState<{ attempts: ExamAttempt[] }>();
  if (loaded.state === 'ok' && loaded.data !== shown) setShown(loaded.data);

  const save = async (attempt: ExamAttempt | null, input: ExamAttemptInput) => {
    setSaving(true);
    try {
      if (attempt) await examAttemptApi.update(certification.id, attempt.id, input);
      else await examAttemptApi.create(certification.id, input);
    } finally {
      setSaving(false);
    }
    setEditing({ open: false, attempt });
    setVersion((current) => current + 1);
    toast.success('응시 기록을 저장했습니다');
    const newlyPassed = input.outcome === 'passed' && attempt?.outcome !== 'passed';
    if (newlyPassed && certification.status !== 'passed') setAskPassed(true);
  };

  const remove = async (attempt: ExamAttempt) => {
    try {
      await examAttemptApi.remove(certification.id, attempt.id);
    } catch (error) {
      // Already gone counts as deleted; anything else keeps the dialog open with the reason.
      if (!(error instanceof RequestError && error.status === 404)) {
        toast.error(errorText(error, '기록을 지우지 못했습니다'));
        throw error;
      }
    }
    toast.success('응시 기록을 지웠습니다');
    setVersion((current) => current + 1);
  };

  const addButton = (
    <Button variant="outline" onClick={(event) => openForm(event, null)}>
      <Plus aria-hidden />
      기록 추가
    </Button>
  );
  const attempts = (loaded.state === 'ok' ? loaded.data : shown)?.attempts ?? [];
  const current = currentAttempt(attempts);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} ref={heading} tabIndex={-1} className="outline-none">
          응시·취득 기록
        </h2>
        {attempts.length > 0 ? addButton : null}
      </div>
      {loaded.state === 'loading' && !shown ? <SkeletonList rows={2} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: errorText(loaded.error, '기록을 불러오지 못했습니다') }}
        />
      ) : null}
      {loaded.state === 'ok' && attempts.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="아직 응시 기록이 없습니다"
          description="시험을 보면 점수와 결과를 적어 두세요. 유효기간이 있는 자격증은 만료일을 함께 챙겨 드립니다."
          action={addButton}
        />
      ) : null}
      {attempts.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {attempts.map((attempt) => {
            const state = expiryState(attempt, certification.validityKind);
            const result = resultText(attempt);
            return (
              <li
                key={attempt.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={attempt.examDate} className="font-semibold">
                      {attempt.examDate}
                    </time>
                    <Badge variant={outcomeVariant[attempt.outcome]}>
                      {outcomeLabels[attempt.outcome]}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${attempt.examDate} 기록 수정`}
                      onClick={(event) => openForm(event, attempt)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      title="기록을 지울까요?"
                      description={`${attempt.examDate} 응시 기록을 지웁니다. 되돌릴 수 없습니다.`}
                      onConfirm={() => remove(attempt)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={`${attempt.examDate} 기록 삭제`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                </div>
                {result ? (
                  <p className="flex flex-wrap items-center gap-2 text-body">
                    {result}
                    {reachedGoal(attempt.score, certification.targetScore) ? (
                      <Badge variant="success">목표 달성</Badge>
                    ) : null}
                  </p>
                ) : null}
                {state !== null && attempt.id !== current?.id ? (
                  <p className="text-body-sm text-muted-foreground">새 기록 있음</p>
                ) : null}
                {state !== null && attempt.id === current?.id ? (
                  <ExpiryLine attempt={attempt} state={state} />
                ) : null}
                {attempt.memo ? (
                  <p className="text-body-sm break-keep whitespace-pre-wrap text-muted-foreground">
                    {attempt.memo}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <Dialog
        open={editing.open}
        // Closing during a save would lose its error and invite a duplicate.
        onOpenChange={(open) => !saving && setEditing((current) => ({ ...current, open }))}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // A saved first record replaces the button that opened the form.
            (opener.current?.isConnected ? opener.current : heading.current)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing.attempt ? '응시 기록 수정' : '응시 기록 추가'}</DialogTitle>
            <DialogDescription className="break-keep">{certification.name}</DialogDescription>
          </DialogHeader>
          <AttemptForm
            certification={certification}
            attempt={editing.attempt}
            onSubmit={(input) => save(editing.attempt, input)}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={askPassed}
        onOpenChange={setAskPassed}
        title="목표 상태를 합격으로 바꿀까요?"
        description={`'${certification.name}' 목표의 상태를 "합격"으로 바꿉니다.`}
        confirmLabel="바꾸기"
        cancelLabel="그대로 두기"
        destructive={false}
        onConfirm={onMarkPassed}
      />
    </section>
  );
}

const loadLatest = () => examAttemptApi.latest();

/** Dashboard card: goals whose newest result has expired or expires within 90 days. */
export function ExpiringCertifications({ paths }: { paths: CertificationPaths }) {
  const loaded = useLoad('latest', loadLatest);
  const attempts = loaded.state === 'ok' ? expiringSoon(loaded.data.attempts) : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          만료 임박
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loaded.state === 'loading' ? <SkeletonList rows={2} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(loaded.error, '만료일을 불러오지 못했습니다'),
            }}
          />
        ) : null}
        {loaded.state === 'ok' && attempts.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            만료가 가까운 자격증이 없습니다. 만료일까지 90일 이하로 남으면 여기에 보입니다.
          </p>
        ) : null}
        {attempts.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <Link
                    to={paths.detail(attempt.certificationId)}
                    className="truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {attempt.name}
                  </Link>
                  <span className="text-caption text-muted-foreground">
                    <time dateTime={attempt.expiresOn ?? undefined}>{attempt.expiresOn}</time>
                    {attempt.daysUntilExpiry === null
                      ? null
                      : ` · ${expiryCountdown(attempt.daysUntilExpiry)}`}
                  </span>
                </div>
                <ExpiryBadge state={expiryState(attempt, attempt.validityKind) ?? 'soon'} />
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
