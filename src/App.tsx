import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CatalogProvider } from './app/CatalogProvider';
import { Layout } from './app/Layout';
import { CatalogRoute } from './routes/Catalog';
import { CompareRoute } from './routes/Compare';
import { DetailRoute } from './routes/Detail';
import { ChartsRoute } from './routes/Charts';

/**
 * Routing (task 7.1).
 *
 * `HashRouter` keeps every route reachable from a plain static server with no
 * rewrite rules — there is no server of our own to configure (design D5).
 */
export function App() {
  return (
    <CatalogProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<CatalogRoute />} />
            <Route path="/vergleich" element={<CompareRoute />} />
            <Route path="/modell/:id" element={<DetailRoute />} />
            <Route path="/diagramme" element={<ChartsRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </CatalogProvider>
  );
}
