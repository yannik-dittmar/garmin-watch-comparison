import { useCallback, useEffect, useState } from 'react';

/**
 * The favourites shortlist (task 7.3).
 *
 * Kept in `localStorage` rather than in the URL: a shortlist is personal and
 * should survive a reload, while the URL carries what is worth sharing.
 */

const KEY = 'gwc:favourites';

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<string[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(favourites));
    } catch {
      // A full or blocked storage must not break browsing.
    }
  }, [favourites]);

  // Keep two tabs of the same snapshot in agreement.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setFavourites(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavourites((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }, []);

  const isFavourite = useCallback((id: string) => favourites.includes(id), [favourites]);

  return { favourites, toggle, isFavourite };
}
