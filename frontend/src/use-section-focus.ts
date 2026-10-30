import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Where keyboard focus goes in a section whose dialogs have no trigger and whose rows can disappear.
 * Put `heading` on the section heading (with tabIndex={-1}), call `remember` when a button opens the dialog,
 * pass `restore` as the dialog's onCloseAutoFocus, and call `afterRemoval` when a row is deleted.
 */
export function useSectionFocus() {
  const opener = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [removals, setRemovals] = useState(0);
  useEffect(() => {
    if (removals > 0) heading.current?.focus();
  }, [removals]);

  const remember = useCallback((event: MouseEvent<HTMLElement>) => {
    opener.current = event.currentTarget;
  }, []);
  const restore = useCallback((event: Event) => {
    event.preventDefault();
    // A saved first row replaces the button that opened the form.
    (opener.current?.isConnected ? opener.current : heading.current)?.focus();
  }, []);
  const afterRemoval = useCallback(() => setRemovals((current) => current + 1), []);
  return { heading, remember, restore, afterRemoval };
}
