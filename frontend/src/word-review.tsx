import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { errorText } from './lib/use-notice';
import { useReloading } from './use-load';
import { type ReviewAnswer, reviewAnswerLabels, type WordPaths, wordReviewApi } from './word-data';

// Know / Unsure / Don't know for a word (#209), and the dashboard card of the words due today.

const answers: ReviewAnswer[] = ['know', 'unsure', 'dontKnow'];

/** The three answer buttons of one word; `onAnswered` runs after the answer is saved. */
export function ReviewButtons({
  id,
  lemma,
  onAnswered,
}: {
  id: number;
  lemma: string;
  onAnswered?: (answer: ReviewAnswer) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState<ReviewAnswer>();
  const answer = async (value: ReviewAnswer) => {
    setSaving(true);
    try {
      await wordReviewApi.answer(id, value);
      setLast(value);
      onAnswered?.(value);
    } catch (error) {
      toast.error(errorText(error, 'Could not save the answer'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div role="group" aria-label={`Review ${lemma}`} className="flex flex-wrap gap-2">
      {answers.map((value) => (
        <Button
          key={value}
          variant={last === value ? 'default' : 'outline'}
          size="sm"
          aria-pressed={last === value}
          aria-label={`${reviewAnswerLabels[value]}: ${lemma}`}
          disabled={saving}
          onClick={() => void answer(value)}
        >
          {reviewAnswerLabels[value]}
        </Button>
      ))}
    </div>
  );
}

/** "N words to review today"; each due word has the answer buttons and leaves the list once answered. */
export function DueWordsCard({ paths }: { paths: WordPaths }) {
  const { loaded, data, reload } = useReloading('due', () => wordReviewApi.due());
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="text-body">
          Words to review today
        </CardTitle>
        <p role="status" className="text-caption text-muted-foreground">
          {data
            ? `${data.words.length} ${data.words.length === 1 ? 'word' : 'words'} to review`
            : null}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!data && loaded.state === 'loading' ? <SkeletonList rows={2} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{
              kind: 'error',
              text: errorText(loaded.error, 'Could not load the review list'),
            }}
          />
        ) : null}
        {data?.words.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            Nothing to review today. Answer a word on the Today page or the word list to schedule
            it.
          </p>
        ) : null}
        {data && data.words.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {data.words.map((word) => (
              <li key={word.id} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0">
                <div className="flex flex-col">
                  <Link
                    to={paths.detail(word.id)}
                    lang="en"
                    className="w-fit font-medium wrap-anywhere underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {word.lemma}
                  </Link>
                  {word.meaningKo ? (
                    <span className="text-body-sm break-keep text-muted-foreground">
                      {word.meaningKo}
                    </span>
                  ) : null}
                </div>
                <ReviewButtons
                  id={word.id}
                  lemma={word.lemma}
                  onAnswered={() =>
                    reload((current) => ({
                      ...current,
                      words: current.words.filter((other) => other.id !== word.id),
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
