import { requestJson } from './lib/api';

// Things the user must do outside the app (#60): API calls and display rules. The screen is in user-actions.tsx.

export type UserAction = {
  id: number;
  title: string;
  note: string;
  linkUrl: string;
  /** The alert appears from this day on. */
  remindFrom: string;
  dueDate: string | null;
  /** Days from today (Asia/Seoul) to the deadline; negative once it has passed. */
  daysUntilDue: number | null;
  completedAt: string | null;
};

/** The count on the bell. Large counts stay short so the badge keeps its shape. */
export const alertCount = (count: number) => (count > 99 ? '99+' : String(count));

export const userActionApi = {
  list: () => requestJson<{ today: string; actions: UserAction[] }>('/api/user-actions'),
  complete: (id: number) =>
    requestJson<{ action: UserAction }>(`/api/user-actions/${id}/completion`, {
      method: 'PUT',
      body: { completed: true },
    }),
};
