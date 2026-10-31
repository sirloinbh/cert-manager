import { Badge } from './components/ui/badge';
import { type GradeScale, scoreRange } from './grade-scale-data';

/** The scale from the highest level down, with the goal's target and the newest result marked. */
export function GradeLadder({
  scale,
  target,
  latest,
}: {
  scale: GradeScale;
  target: string | null;
  latest: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <h3 className="text-body font-semibold">{scale.label} 등급</h3>
      <ul className="flex flex-col divide-y">
        {[...scale.levels].reverse().map((level) => (
          <li
            key={level.value}
            className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
          >
            <span className="flex flex-wrap items-center gap-2 text-body-sm">
              <span className="font-medium">{level.value}</span>
              {level.value === target ? <Badge>목표</Badge> : null}
              {level.value === latest ? <Badge variant="secondary">최근 결과</Badge> : null}
            </span>
            <span className="text-caption text-muted-foreground">{scoreRange(level)}</span>
          </li>
        ))}
      </ul>
      <p className="text-caption break-keep text-muted-foreground">{scale.note}</p>
      <a
        href={scale.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-caption text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        출처 보기
      </a>
    </div>
  );
}
