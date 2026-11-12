import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, type MouseEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import {
  type Certification,
  type CertificationPaths,
  deadlineCountdown,
} from './certification-data';
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
import { formatDate } from './date-format';
import {
  addMonths,
  currentAttempt,
  type ExamAttempt,
  examAttemptApi,
  type ExamAttemptInput,
  expiringSoon,
  expiryLabels,
  type ExpiryState,
  expiryState,
  hasExpiry,
  type Outcome,
  outcomeLabels,
  outcomes,
  reachedTarget,
} from './exam-attempt-data';
import { controlClass, toNumber } from './form-fields';
import { type GradeScale, gradesForScore } from './grade-scale-data';
import { GradeLadder } from './grade-scales';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import { cn } from './lib/utils';
import { useLoad, useReloading } from './use-load';
import { useSectionFocus } from './use-section-focus';

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
          <time dateTime={attempt.expiresOn}>{formatDate(attempt.expiresOn)}</time>
          {' · '}
          {deadlineCountdown(attempt.daysUntilExpiry)}
        </span>
      ) : null}
    </p>
  );
}

function resultText(attempt: ExamAttempt) {
  const score = attempt.score === null ? '' : `${attempt.score}`;
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
  gradeScale,
  attempt,
  onSubmit,
}: {
  certification: Certification;
  gradeScale: GradeScale | undefined;
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
  // Likewise a saved grade stays. Until there is one, the grade follows the score when one level fits.
  const [gradeEdited, setGradeEdited] = useState(Boolean(attempt?.grade));
  const [pending, setPending] = useState(false);
  const expiryInput = useRef<HTMLInputElement>(null);
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
  const score = toNumber(form.score);
  const fitting = gradeScale && typeof score === 'number' ? gradesForScore(gradeScale, score) : [];
  const suggested = fitting.length === 1 ? (fitting[0]?.value ?? '') : '';
  const grade = gradeScale && !gradeEdited ? suggested : form.grade;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    notice.clear();
    onSubmit({
      examDate: form.examDate,
      outcome: form.outcome,
      score: showResult ? toNumber(form.score) : null,
      grade: showResult ? grade : null,
      expiresOn: showExpiry && expiresOn !== '' ? expiresOn : null,
      memo: form.memo,
    }).catch((error: unknown) => {
      notice.error(error, 'Could not save');
      setPending(false);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending || undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>Exam date</Label>
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
          <Label htmlFor={`${id}-outcome`}>Result</Label>
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
            <Label htmlFor={`${id}-score`}>Score</Label>
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
                The target score is {certification.targetScore}.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-grade`}>Grade</Label>
            {gradeScale ? (
              <>
                <select
                  id={`${id}-grade`}
                  className={cn(controlClass, 'h-9')}
                  value={grade}
                  onChange={(e) => {
                    setGradeEdited(true);
                    set('grade')(e.target.value);
                  }}
                  aria-describedby={`${id}-grade-hint`}
                >
                  <option value="">None</option>
                  {[...gradeScale.levels].reverse().map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.value}
                    </option>
                  ))}
                  {/* An older format such as "Level 7" stays selectable until the user changes it. */}
                  {grade && !gradeScale.levels.some((level) => level.value === grade) ? (
                    <option value={grade}>{grade}</option>
                  ) : null}
                </select>
                <p
                  id={`${id}-grade-hint`}
                  // The grade changes with the score, so the reason is announced too.
                  aria-live="polite"
                  className="text-caption break-keep text-muted-foreground"
                >
                  {fitting.length > 1
                    ? `A score of ${score} is one of ${fitting.map((level) => level.value).join(', ')}. Choose the grade shown on your score report.`
                    : suggested
                      ? `The standard grade for a score of ${score} is ${suggested}.`
                      : 'Choose from the list.'}
                </p>
              </>
            ) : (
              <Input
                id={`${id}-grade`}
                maxLength={200}
                value={form.grade}
                onChange={(e) => {
                  // The list can arrive while this is being typed; what was typed stays.
                  setGradeEdited(true);
                  set('grade')(e.target.value);
                }}
                placeholder="e.g. Level 7, IH"
              />
            )}
          </div>
        </div>
      ) : null}
      {showExpiry ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-expires`}>Expiry date</Label>
          <Input
            id={`${id}-expires`}
            ref={expiryInput}
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
              ? 'This goal has no validity period set. Leave the expiry date empty if you do not know it.'
              : 'If left empty, it is saved as "Expiry unknown".'}
          </p>
          {prefilled !== '' && expiresOn !== prefilled ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto w-fit justify-start p-0 text-left break-keep whitespace-normal"
              onClick={() => {
                setExpiryEdited(false);
                // The button disappears once the date matches, so focus moves to what it filled.
                expiryInput.current?.focus();
              }}
            >
              Fill in {months} months after the exam date ({formatDate(prefilled)})
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-memo`}>Memo</Label>
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
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="Saving" /> : null}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

const loadAttempts = (id: string) => examAttemptApi.list(Number(id));

/** The section on a goal's detail page. Marking the goal passed is left to the page that owns the goal. */
export function ExamAttempts({
  certification,
  gradeScale,
  onMarkPassed,
}: {
  certification: Certification;
  gradeScale: GradeScale | undefined;
  onMarkPassed: () => Promise<unknown>;
}) {
  const { loaded, data, reload } = useReloading(String(certification.id), loadAttempts);
  // The attempt stays while the dialog closes, so its title and form do not change as it fades out.
  const [editing, setEditing] = useState<{ open: boolean; attempt: ExamAttempt | null }>({
    open: false,
    attempt: null,
  });
  const [saving, setSaving] = useState(false);
  const [askPassed, setAskPassed] = useState(false);
  const titleId = useId();
  const focus = useSectionFocus();
  const openForm = (event: MouseEvent<HTMLElement>, attempt: ExamAttempt | null) => {
    focus.remember(event);
    setEditing({ open: true, attempt });
  };

  const save = async (attempt: ExamAttempt | null, input: ExamAttemptInput) => {
    let saved: ExamAttempt;
    setSaving(true);
    try {
      ({ attempt: saved } = attempt
        ? await examAttemptApi.update(certification.id, attempt.id, input)
        : await examAttemptApi.create(certification.id, input));
    } finally {
      setSaving(false);
    }
    setEditing({ open: false, attempt });
    // What was saved shows even if reloading the list then fails.
    reload((list) => ({
      ...list,
      attempts: [saved, ...list.attempts.filter((item) => item.id !== saved.id)].sort(
        (a, b) => b.examDate.localeCompare(a.examDate) || b.id - a.id,
      ),
    }));
    toast.success('Saved the exam attempt');
    const newlyPassed = input.outcome === 'passed' && attempt?.outcome !== 'passed';
    if (newlyPassed && certification.status !== 'passed') setAskPassed(true);
  };

  const remove = async (attempt: ExamAttempt) => {
    try {
      await examAttemptApi.remove(certification.id, attempt.id);
    } catch (error) {
      // Already gone counts as deleted; anything else keeps the dialog open with the reason.
      if (!(error instanceof RequestError && error.status === 404)) {
        toast.error(errorText(error, 'Could not delete the attempt'));
        throw error;
      }
    }
    toast.success('Deleted the exam attempt');
    focus.afterRemoval();
    reload((list) => ({
      ...list,
      attempts: list.attempts.filter((item) => item.id !== attempt.id),
    }));
  };

  const addButton = (
    <Button variant="outline" onClick={(event) => openForm(event, null)}>
      <Plus aria-hidden />
      Add attempt
    </Button>
  );
  const attempts = data?.attempts ?? [];
  const current = currentAttempt(attempts);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} ref={focus.heading} tabIndex={-1} className="outline-none">
          Exam attempts
        </h2>
        {attempts.length > 0 ? addButton : null}
      </div>
      {gradeScale ? (
        <GradeLadder
          scale={gradeScale}
          target={certification.targetGrade}
          latest={current?.grade ?? null}
        />
      ) : null}
      {loaded.state === 'loading' && !data ? <SkeletonList rows={2} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: errorText(loaded.error, 'Could not load the attempts') }}
        />
      ) : null}
      {data && attempts.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<ClipboardList />}
          title="No exam attempts yet"
          description="After you take an exam, record the score and result. For certifications with a validity period, the expiry date is tracked too."
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
                      {formatDate(attempt.examDate)}
                    </time>
                    <Badge variant={outcomeVariant[attempt.outcome]}>
                      {outcomeLabels[attempt.outcome]}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit attempt on ${formatDate(attempt.examDate)}`}
                      onClick={(event) => openForm(event, attempt)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      title="Delete this attempt?"
                      description={`This deletes the exam attempt on ${formatDate(attempt.examDate)}. This cannot be undone.`}
                      onConfirm={() => remove(attempt)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={`Delete attempt on ${formatDate(attempt.examDate)}`}
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
                    {reachedTarget(attempt, certification, gradeScale) ? (
                      <Badge variant="success">Goal reached</Badge>
                    ) : null}
                  </p>
                ) : null}
                {state !== null && attempt.id !== current?.id ? (
                  <p className="text-body-sm text-muted-foreground">Newer attempt exists</p>
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
        <DialogContent onCloseAutoFocus={focus.restore}>
          <DialogHeader>
            <DialogTitle>{editing.attempt ? 'Edit exam attempt' : 'Add exam attempt'}</DialogTitle>
            <DialogDescription className="break-keep">{certification.name}</DialogDescription>
          </DialogHeader>
          <AttemptForm
            certification={certification}
            gradeScale={gradeScale}
            attempt={editing.attempt}
            onSubmit={(input) => save(editing.attempt, input)}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={askPassed}
        onOpenChange={setAskPassed}
        title="Change the goal status to Passed?"
        description={`This changes the status of the '${certification.name}' goal to "Passed".`}
        confirmLabel="Change"
        cancelLabel="Keep as is"
        destructive={false}
        onConfirm={onMarkPassed}
        returnFocusRef={focus.heading}
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
          Expiring soon
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loaded.state === 'loading' ? <SkeletonList rows={2} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(loaded.error, 'Could not load the expiry dates'),
            }}
          />
        ) : null}
        {loaded.state === 'ok' && attempts.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            No certifications are close to expiring. They show up here when 90 days or fewer remain.
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
                    <time dateTime={attempt.expiresOn ?? undefined}>
                      {attempt.expiresOn ? formatDate(attempt.expiresOn) : null}
                    </time>
                    {attempt.daysUntilExpiry === null
                      ? null
                      : ` · ${deadlineCountdown(attempt.daysUntilExpiry)}`}
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
