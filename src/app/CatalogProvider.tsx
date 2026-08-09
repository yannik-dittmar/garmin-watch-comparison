import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadCatalog, type Catalog } from '../data/load';
import type { CatalogModel } from '../data/contract';

interface CatalogState {
  status: 'loading' | 'ready' | 'error';
  catalog: Catalog | null;
  error: string | null;
  byId: Map<string, CatalogModel>;
  families: string[];
}

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((loaded) => {
        if (!cancelled) setCatalog(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const state = useMemo<CatalogState>(() => {
    const byId = new Map<string, CatalogModel>();
    for (const model of catalog?.models ?? []) byId.set(model.id, model);
    const families = [...new Set((catalog?.models ?? []).map((m) => m.lineage.family))].sort((a, b) =>
      a.localeCompare(b, 'de'),
    );
    return {
      status: error ? 'error' : catalog ? 'ready' : 'loading',
      catalog,
      error,
      byId,
      families,
    };
  }, [catalog, error]);

  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const state = useContext(CatalogContext);
  if (!state) throw new Error('useCatalog must be used inside CatalogProvider');
  return state;
}
