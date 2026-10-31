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
import { errorText } from './lib/use-notice';
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
        // Not cn(): tailwind-merge takes text-caption for a color and drops it (project-standards#357).
        <p className={`text-caption ${overdue ? 'font-semibold text-destructive' : ''}`}>
          <time dateTime={action.dueDate}>{action.dueDate}</time>
          {' · '}
          {deadlineCountdown(action.daysUntilDue)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          aria-busy={pending || undefined}
          aria-label={`'${action.title}' 완료`}
          onClick={onComplete}
        >
          <Check aria-hidden />
          완료
        </Button>
        {action.linkUrl ? (
          <Button asChild variant="link" size="sm">
            <a href={action.linkUrl} target="_blank" rel="noreferrer">
              바로가기
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

  // Once per visit, so that alerts are seen without opening the panel.
  const announced = useRef(false);
  const firstCount = loaded.state === 'ok' ? loaded.data.actions.length : 0;
  useEffect(() => {
    if (announced.current || firstCount === 0) return;
    announced.current = true;
    toast(`직접 할 일이 ${firstCount}건 있습니다`, {
      description: '상단의 종 아이콘에서 볼 수 있습니다.',
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
      toast.success('완료로 표시했습니다');
      // The button is gone with its row, so focus goes to the panel title.
      title.current?.focus();
    } catch (error) {
      toast.error(errorText(error, '완료로 표시하지 못했습니다'));
    } finally {
      setPendingId(undefined);
    }
  };

  const count = actions.length;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? `직접 할 일 알림 ${count}건` : '직접 할 일 알림'}
        >
          <Bell aria-hidden />
          {count > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] leading-none font-semibold text-white"
            >
              {alertCount(count)}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle ref={title} tabIndex={-1} className="outline-none">
            직접 할 일
          </SheetTitle>
          <SheetDescription className="break-keep">
            앱이 대신할 수 없어 직접 해야 하는 일입니다. 마친 일은 완료로 표시하세요.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {loaded.state === 'loading' && !data ? <SkeletonList rows={2} /> : null}
          {loaded.state === 'error' ? (
            <Notice
              notice={{
                kind: 'error',
                text: errorText(loaded.error, '알림을 불러오지 못했습니다'),
              }}
            />
          ) : null}
          {data && count === 0 ? (
            <p className="text-body-sm break-keep text-muted-foreground">
              지금 직접 할 일이 없습니다.
            </p>
          ) : null}
          {count > 0 ? (
            <ul className="flex flex-col gap-3">
              {actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  pending={pendingId === action.id}
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
