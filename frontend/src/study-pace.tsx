import type { Certification } from './certification-data';
import { plural } from './lib/format';
import { cn } from './lib/utils';
import { studyPace } from './study-pace-data';
import type { StudyStage } from './study-plan-data';

/** The pace message shown next to the exam countdown; nothing while there is no plan or nothing to pace. */
export function StudyPaceMessage({
  certification,
  stages,
}: {
  certification: Certification;
  stages: StudyStage[] | undefined;
}) {
  if (stages === undefined) return null;
  const pace = studyPace(stages, certification.daysUntilExam, certification.targetExamDate);
  if (pace === null) return null;
  return (
    <p className="text-body-sm" data-testid="study-pace">
      <span>
        {plural(pace.perDay, 'task')} a day · {plural(pace.open, 'task')} open,{' '}
        {plural(pace.daysLeft, 'day')} left
      </span>
      {pace.behind ? (
        <strong className={cn('ml-2 font-medium text-destructive')}>Behind plan</strong>
      ) : null}
    </p>
  );
}
