import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, type MouseEvent, useId, useState } from 'react';
import { Link } from 'react-router';

import {
  type Certification,
  type CertificationPaths,
  deadlineCountdown,
  examCountdown,
} from './certification-data';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Checkbox } from './components/ui/checkbox';
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
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import { cn } from './lib/utils';
import {
  isOverdue,
  periodText,
  progress,
  type StudyPlan as Plan,
  studyPlanApi,
  type StudyStage,
  type StudyTask,
  withChoices,
} from './study-plan-data';
import { useLoad, useReloading } from './use-load';
import { useSectionFocus } from './use-section-focus';

// Screens for study plans (#33): the section on a goal's detail page and the dashboard card.

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  );
}

function ProgressLine({ label, tasks }: { label: string; tasks: StudyTask[] }) {
  const value = progress(tasks);
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body-sm wrap-anywhere">
        {label} {value.done}/{value.total} · {value.percent}%
      </p>
      <ProgressBar label={label} value={value.percent} />
    </div>
  );
}

type DateField = { key: string; label: string };

/** The form for a stage or a task: a title and the dates each one has. */
function ItemForm({
  titleLabel,
  placeholder,
  title,
  fields,
  dates,
  onSubmit,
}: {
  titleLabel: string;
  placeholder: string;
  title: string;
  fields: DateField[];
  dates: Record<string, string | null>;
  onSubmit: (title: string, dates: Record<string, string | null>) => Promise<unknown>;
}) {
  const [text, setText] = useState(title);
  const [values, setValues] = useState(dates);
  const [pending, setPending] = useState(false);
  const notice = useNotice();
  const id = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    notice.clear();
    onSubmit(text, values).catch((error: unknown) => {
      notice.error(error, 'Could not save');
      setPending(false);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending || undefined}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>{titleLabel}</Label>
        <Input
          id={`${id}-title`}
          required
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-2">
            <Label htmlFor={`${id}-${field.key}`}>{field.label}</Label>
            <Input
              id={`${id}-${field.key}`}
              type="date"
              max="9999-12-31"
              value={values[field.key] ?? ''}
              onChange={(e) =>
                setValues((current) => ({ ...current, [field.key]: e.target.value || null }))
              }
            />
          </div>
        ))}
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

type Target =
  | { kind: 'stage'; stage: StudyStage | null }
  | { kind: 'task'; stage: StudyStage; task: StudyTask | null };

const stageFields: DateField[] = [
  { key: 'startDate', label: 'Start date' },
  { key: 'endDate', label: 'End date' },
];
const taskFields: DateField[] = [{ key: 'dueDate', label: 'Due date' }];

const withoutTask = (id: number) => (plan: Plan) => ({
  ...plan,
  stages: plan.stages.map((stage) => ({
    ...stage,
    tasks: stage.tasks.filter((task) => task.id !== id),
  })),
});
const withoutStage = (id: number) => (plan: Plan) => ({
  ...plan,
  stages: plan.stages.filter((stage) => stage.id !== id),
});
const withStage = (saved: Omit<StudyStage, 'tasks'>) => (plan: Plan) => ({
  ...plan,
  stages: plan.stages.some((stage) => stage.id === saved.id)
    ? plan.stages.map((stage) => (stage.id === saved.id ? { ...stage, ...saved } : stage))
    : [...plan.stages, { ...saved, tasks: [] }],
});
const withNewTask = (saved: StudyTask) => (plan: Plan) => ({
  ...plan,
  stages: plan.stages.map((stage) =>
    stage.id === saved.stageId ? { ...stage, tasks: [...stage.tasks, saved] } : stage,
  ),
});
const withTask = (saved: StudyTask) => (plan: Plan) => ({
  ...plan,
  stages: plan.stages.map((stage) => ({
    ...stage,
    tasks: stage.tasks.map((task) => (task.id === saved.id ? saved : task)),
  })),
});

const loadPlan = (id: string) => studyPlanApi.plan(Number(id));

/** The section on a goal's detail page. */
export function StudyPlan({ certification }: { certification: Certification }) {
  const { loaded, data, reload } = useReloading(String(certification.id), loadPlan);
  // The target stays while the dialog closes, so its title and form do not change as it fades out.
  const [editing, setEditing] = useState<{ open: boolean; target: Target }>({
    open: false,
    target: { kind: 'stage', stage: null },
  });
  const [saving, setSaving] = useState(false);
  // What was chosen for tasks still being saved. A click before the answer arrives is ignored.
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const focus = useSectionFocus();
  const titleId = useId();

  const open = (event: MouseEvent<HTMLElement>, target: Target) => {
    focus.remember(event);
    setEditing({ open: true, target });
  };

  const save = async (text: string, dates: Record<string, string | null>) => {
    const { target } = editing;
    let change: (plan: Plan) => Plan;
    setSaving(true);
    try {
      if (target.kind === 'stage') {
        const input = {
          title: text,
          startDate: dates.startDate ?? null,
          endDate: dates.endDate ?? null,
        };
        const { stage } = target.stage
          ? await studyPlanApi.updateStage(target.stage.id, input)
          : await studyPlanApi.createStage(certification.id, input);
        change = withStage(stage);
      } else {
        const input = { title: text, dueDate: dates.dueDate ?? null };
        const { task } = target.task
          ? await studyPlanApi.updateTask(target.task.id, input)
          : await studyPlanApi.createTask(target.stage.id, input);
        change = target.task ? withTask(task) : withNewTask(task);
      }
    } finally {
      setSaving(false);
    }
    setEditing((current) => ({ ...current, open: false }));
    // What was saved shows even if reloading the plan then fails.
    reload(change);
    toast.success('Saved');
  };

  const remove = async (
    request: () => Promise<unknown>,
    change: (plan: Plan) => Plan,
    done: string,
  ) => {
    try {
      await request();
    } catch (error) {
      // Already gone counts as deleted; anything else keeps the dialog open with the reason.
      if (!(error instanceof RequestError && error.status === 404)) {
        toast.error(errorText(error, 'Could not delete'));
        throw error;
      }
    }
    toast.success(done);
    focus.afterRemoval();
    reload(change);
  };

  const setCompleted = async (task: StudyTask, completed: boolean) => {
    if (checking[task.id] !== undefined) return;
    setChecking((current) => ({ ...current, [task.id]: completed }));
    try {
      const saved = await studyPlanApi.setCompleted(task.id, completed);
      reload(withTask(saved.task));
    } catch (error) {
      toast.error(errorText(error, 'Could not save the task'));
      reload();
    } finally {
      setChecking(({ [task.id]: _done, ...rest }) => rest);
    }
  };

  const stages = withChoices(data?.stages ?? [], checking);
  const allTasks = stages.flatMap((stage) => stage.tasks);
  const { target } = editing;
  const addStage = (
    <Button variant="outline" onClick={(event) => open(event, { kind: 'stage', stage: null })}>
      <Plus aria-hidden />
      Add stage
    </Button>
  );

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} ref={focus.heading} tabIndex={-1} className="outline-none">
          Study plan
        </h2>
        {stages.length > 0 ? addStage : null}
      </div>
      {loaded.state === 'loading' && !data ? <SkeletonList rows={2} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: errorText(loaded.error, 'Could not load the plan') }}
        />
      ) : null}
      {data && stages.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<ListChecks />}
          title="No study plan yet"
          description="Split the plan into stages such as weeks or subjects and add tasks to see your progress."
          action={addStage}
        />
      ) : null}
      {stages.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ProgressLine label="Overall progress" tasks={allTasks} />
          {certification.targetExamDate !== null ? (
            <p className="text-body-sm text-muted-foreground">
              Until the target exam date: {examCountdown(certification.daysUntilExam)}
            </p>
          ) : null}
        </div>
      ) : null}
      {stages.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-body font-semibold wrap-anywhere break-keep">
                    {stage.title}
                  </h3>
                  {periodText(stage) ? (
                    <p className="text-caption text-muted-foreground">{periodText(stage)}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit stage ${stage.title}`}
                    onClick={(event) => open(event, { kind: 'stage', stage })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmDialog
                    title="Delete this stage?"
                    description={
                      <span className="wrap-anywhere break-keep">
                        {`This deletes the '${stage.title}' stage and its ${stage.tasks.length} tasks. This cannot be undone.`}
                      </span>
                    }
                    onConfirm={() =>
                      remove(
                        () => studyPlanApi.removeStage(stage.id),
                        withoutStage(stage.id),
                        'Deleted the stage',
                      )
                    }
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label={`Delete stage ${stage.title}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                </div>
              </div>
              <ProgressLine label={`${stage.title} progress`} tasks={stage.tasks} />
              {stage.tasks.length > 0 ? (
                <ul className="flex flex-col divide-y">
                  {stage.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      busy={checking[task.id] !== undefined}
                      onCheck={(completed) => void setCompleted(task, completed)}
                      onEdit={(event) => open(event, { kind: 'task', stage, task })}
                      onRemove={() =>
                        remove(
                          () => studyPlanApi.removeTask(task.id),
                          withoutTask(task.id),
                          'Deleted the task',
                        )
                      }
                    />
                  ))}
                </ul>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                aria-label={`Add a task to ${stage.title}`}
                onClick={(event) => open(event, { kind: 'task', stage, task: null })}
              >
                <Plus aria-hidden />
                Add task
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog
        open={editing.open}
        // Closing during a save would lose its error and invite a duplicate.
        onOpenChange={(next) => !saving && setEditing((current) => ({ ...current, open: next }))}
      >
        <DialogContent onCloseAutoFocus={focus.restore}>
          <DialogHeader>
            <DialogTitle>{dialogTitle(target)}</DialogTitle>
            <DialogDescription className="wrap-anywhere break-keep">
              {target.kind === 'task' ? target.stage.title : certification.name}
            </DialogDescription>
          </DialogHeader>
          {target.kind === 'stage' ? (
            <ItemForm
              titleLabel="Stage name"
              placeholder="e.g. Week 1, past exam practice"
              title={target.stage?.title ?? ''}
              fields={stageFields}
              dates={{
                startDate: target.stage?.startDate ?? null,
                endDate: target.stage?.endDate ?? null,
              }}
              onSubmit={save}
            />
          ) : (
            <ItemForm
              titleLabel="Task"
              placeholder="e.g. Solve past exam 1"
              title={target.task?.title ?? ''}
              fields={taskFields}
              dates={{ dueDate: target.task?.dueDate ?? null }}
              onSubmit={save}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function dialogTitle(target: Target) {
  if (target.kind === 'stage') return target.stage ? 'Edit stage' : 'Add stage';
  return target.task ? 'Edit task' : 'Add task';
}

function TaskRow({
  task,
  busy,
  onCheck,
  onEdit,
  onRemove,
}: {
  task: StudyTask;
  busy: boolean;
  onCheck: (completed: boolean) => void;
  onEdit: (event: MouseEvent<HTMLElement>) => void;
  onRemove: () => Promise<unknown>;
}) {
  const id = useId();
  const done = task.completedAt !== null;
  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <Checkbox
          id={id}
          className={cn('mt-1', busy && 'opacity-60')}
          checked={done}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          onCheckedChange={(next) => onCheck(next === true)}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            htmlFor={id}
            className={cn(
              'text-body leading-normal font-normal wrap-anywhere break-keep',
              done && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </Label>
          {task.dueDate !== null && task.daysUntilDue !== null ? (
            <p className="text-caption text-muted-foreground">
              <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time>
              {done ? null : (
                <span className={cn(isOverdue(task) && 'font-medium text-destructive')}>
                  {' · '}
                  {deadlineCountdown(task.daysUntilDue)}
                </span>
              )}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" aria-label={`Edit ${task.title}`} onClick={onEdit}>
          <Pencil aria-hidden />
        </Button>
        <ConfirmDialog
          title="Delete this task?"
          description={
            <span className="wrap-anywhere break-keep">
              {`This deletes '${task.title}'. This cannot be undone.`}
            </span>
          }
          onConfirm={onRemove}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 aria-hidden />
            </Button>
          }
        />
      </div>
    </li>
  );
}

const loadToday = () => studyPlanApi.today();

/** Dashboard card: unfinished tasks due today or earlier. */
export function TodayTasks({ paths }: { paths: CertificationPaths }) {
  const loaded = useLoad('today', loadToday);
  const tasks = loaded.state === 'ok' ? loaded.data.tasks : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          Today’s tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loaded.state === 'loading' ? <SkeletonList rows={2} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{ kind: 'error', text: errorText(loaded.error, 'Could not load the tasks') }}
          />
        ) : null}
        {loaded.state === 'ok' && tasks.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            No tasks for today. Set a due date on a task in a study plan and it shows up here.
          </p>
        ) : null}
        {tasks.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <Link
                    to={paths.detail(task.certificationId)}
                    className="truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {task.title}
                  </Link>
                  <span className="truncate text-caption text-muted-foreground">
                    {task.certificationName}
                  </span>
                </div>
                {task.daysUntilDue === null ? null : (
                  <strong
                    className={cn(
                      'shrink-0 text-body-sm font-semibold',
                      isOverdue(task) && 'text-destructive',
                    )}
                  >
                    {deadlineCountdown(task.daysUntilDue)}
                  </strong>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
