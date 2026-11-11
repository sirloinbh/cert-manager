import { Bell, Check, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { deadlineCountdown } from './certification-data';
import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { formatDate } from './date-format';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { useReloading } from './use-load';
import { alertCount, type UserAction, userActionApi } from './user-action-data';

// Alerts for things the user must do outside the app (#60): the bell in the top bar and its panel.

const loadActions = () => userActionApi.list();

function ActionItem({
  action,
  pending,
  onComplete,
}: {
  action: UserAction;
  pending: boolean;
  onComplete: () => void;
}) {
  const overdue = action.daysUntilDue !== null && action.daysUntilDue < 0;
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground">
      <p className="text-body-sm font-medium wrap-anywhere break-keep">{action.title}</p>
      {action.note ? (
        <p className="text-caption wrap-anywhere break-keep whitespace-pre-wrap text-muted-foreground">
          {action.note}
        </p>
      ) : null}
      {action.dueDate !== null && action.daysUntilDue !== null ? (
        <p className={cn('text-caption', overdue && 'font-semibold text-destructive')}>
          <time dateTime={action.dueDate}>{formatDate(action.dueDate)}</time>
          {' · '}
          {deadlineCountdown(action.daysUntilDue)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          // Not disabled: a disabled button would drop keyboard focus while the request runs.
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          className={pending ? 'pointer-events-none opacity-60' : undefined}
          aria-label={`Complete '${action.title}'`}
          onClick={pending ? undefined : onComplete}
        >
          <Check aria-hidden />
          Done
        </Button>
        {action.linkUrl ? (
          <Button asChild variant="link" size="sm">
            <a
              href={action.linkUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open the link for '${action.title}' (new tab)`}
            >
              Open link
              <ExternalLink aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Goes in the top bar. The bell shows how many things are waiting; the panel lists them. */
export function UserActionAlerts() {
  const { loaded, data, reload } = useReloading('all', loadActions);
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number>();
  const title = useRef<HTMLHeadingElement>(null);
  const actions = data?.actions ?? [];
  // The last failure stays until a read succeeds, so reloading does not make it look fine for a moment.
  const [lastError, setLastError] = useState<unknown>();
  if (loaded.state === 'error' && loaded.error !== lastError) setLastError(loaded.error);
  if (loaded.state === 'ok' && lastError !== undefined) setLastError(undefined);
  const hasError = lastError !== undefined;
  // Nothing to show because the list failed, which must not look like "nothing to do".
  const failed = hasError && !data;

  // The bell stays mounted across pages, so a tab left open would keep yesterday's alerts and counts.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [reload]);

  // Once per visit, so that alerts are seen without opening the panel.
  const announced = useRef(false);
  const firstCount = loaded.state === 'ok' ? loaded.data.actions.length : 0;
  useEffect(() => {
    if (announced.current || firstCount === 0) return;
    announced.current = true;
    toast(`You have ${firstCount} manual tasks`, {
      description: 'See them from the bell icon at the top.',
      // At the top it would cover the bell it points to.
      position: 'bottom-center',
    });
  }, [firstCount]);

  const complete = async (action: UserAction) => {
    setPendingId(action.id);
    try {
      await userActionApi.complete(action.id);
      // Gone right away, even if reloading the list then fails.
      reload((list) => ({
        ...list,
        actions: list.actions.filter((item) => item.id !== action.id),
      }));
      toast.success('Marked as done');
      // The button is gone with its row, so focus goes to the panel title.
      title.current?.focus();
    } catch (error) {
      toast.error(errorText(error, 'Could not mark as done'));
      // It may already be gone; the list then says what is true.
      reload();
    } finally {
      setPendingId(undefined);
    }
  };

  const count = actions.length;
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reload();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            failed
              ? 'Could not load the manual task alerts'
              : count > 0
                ? `${count} manual task alerts`
                : 'Manual task alerts'
          }
        >
          <Bell aria-hidden />
          {failed || count > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] leading-none font-semibold text-white"
            >
              {failed ? '!' : alertCount(count)}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle ref={title} tabIndex={-1} className="outline-none">
            Manual tasks
          </SheetTitle>
          <SheetDescription className="break-keep">
            These are things the app cannot do for you. Mark finished ones as done.
          </SheetDescription>
        </SheetHeader>
        {/* The list scrolls, not the panel, so the close button stays in reach. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {loaded.state === 'loading' && !data ? <SkeletonList rows={2} /> : null}
          {hasError ? (
            <Notice
              notice={{ kind: 'error', text: errorText(lastError, 'Could not load the alerts') }}
            />
          ) : null}
          {hasError ? (
            // Stays in place while retrying, so keyboard focus is not lost.
            <Button
              variant="outline"
              size="sm"
              aria-disabled={loaded.state === 'loading' || undefined}
              aria-busy={loaded.state === 'loading' || undefined}
              className={`w-fit ${loaded.state === 'loading' ? 'pointer-events-none opacity-60' : ''}`}
              onClick={loaded.state === 'loading' ? undefined : () => reload()}
            >
              Reload
            </Button>
          ) : null}
          {data && count === 0 && !hasError ? (
            <p className="text-body-sm break-keep text-muted-foreground">
              No manual tasks right now.
            </p>
          ) : null}
          {count > 0 ? (
            <ul className="flex flex-col gap-3">
              {actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  pending={pendingId !== undefined}
                  onComplete={() => void complete(action)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
