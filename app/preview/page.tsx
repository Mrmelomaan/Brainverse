import { notFound } from 'next/navigation';
import { SEED, defaultPrefs, type Note } from '@/lib/model';
import Canvas from '@/components/Canvas';

// DEV ONLY. Renders the canvas with an in-memory universe so the UI can be checked without a database or a
// session (proxy.ts lets /preview through in development only). Returns 404 in every other build.
export const dynamic = 'force-dynamic';

export default function Preview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const notes: Note[] = SEED.map((n, i) => ({ ...n, id: 'seed-' + i, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() }));
  return <Canvas initial={{ notes, prefs: defaultPrefs(), account: { id: 'dev', email: 'dev@localhost', name: 'Dev' } }} origin="http://localhost:3000" dry />;
}
