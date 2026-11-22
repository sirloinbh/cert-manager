import { Badge } from './components/ui/badge';
import { type GradeLevel, type GradeScale, scoreRange } from './grade-scale-data';

/**
 * A ranked scale from the highest step down, with the goal's target and the newest result marked. Off-ladder
 * levels (AWS Specialty) are listed apart from the steps, and an unranked scale (license types) is a plain list.
 */
export function GradeLadder({
  scale,
  target,
  latest,
}: {
  scale: GradeScale;
  target: string | null;
  latest: string | null;
}) {
  const ladder = scale.ranked ? scale.levels.filter((level) => !level.offLadder) : scale.levels;
  const apart = scale.ranked ? scale.levels.filter((level) => level.offLadder) : [];
  const steps = scale.ranked ? [...ladder].reverse() : ladder;
  const row = (level: GradeLevel) => (
    <li
      key={level.value}
      className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
    >
      <span className="flex flex-wrap items-center gap-2 text-body-sm">
        <span className="font-medium">{level.label}</span>
        {level.value === target ? <Badge>Target</Badge> : null}
        {level.value === latest ? <Badge variant="secondary">Latest result</Badge> : null}
      </span>
      <span className="text-caption text-muted-foreground">{scoreRange(level)}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <h3 className="text-body font-semibold">
        {scale.ranked ? `${scale.label} grades` : scale.label}
      </h3>
      <ul className="flex flex-col divide-y">{steps.map(row)}</ul>
      {apart.length > 0 ? (
        <>
          <h4 className="text-caption font-medium text-muted-foreground">Not part of the steps</h4>
          <ul className="flex flex-col divide-y">{apart.map(row)}</ul>
        </>
      ) : null}
      <p className="text-caption break-keep text-muted-foreground">{scale.note}</p>
      <a
        href={scale.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-caption text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        View source
      </a>
    </div>
  );
}
