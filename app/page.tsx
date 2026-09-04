import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isAllowedViewer, viewer } from '@/auth';
import { loadOrSeedUniverse } from '@/db';
import Canvas from '@/components/Canvas';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const v = await viewer();
  if (!v) redirect('/login');
  if (!(await isAllowedViewer(v))) redirect('/waiting');
  // A database error surfaces through app/error.tsx; there is no local fallback.
  const universe = await loadOrSeedUniverse(v.id);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'brainverse.mooibekeken.nl'}`;
  return <Canvas initial={{ ...universe, account: { id: v.id, email: v.email, name: v.name } }} origin={origin} />;
}
