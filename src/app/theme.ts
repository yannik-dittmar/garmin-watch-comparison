import { useCallback, useEffect, useState } from 'react';

/**
 * Theme selection (task 7.4).
 *
 * Three states, matching the token layer: `system` leaves the root element
 * untouched so `prefers-color-scheme` decides, while an explicit choice stamps
 * `data-theme` and wins over it in both directions.
 */

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'gwc:theme';

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Persistence is a convenience; the applied theme still holds.
    }
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((current) => (current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'));
  }, []);

  return { choice, setChoice, cycle };
}
