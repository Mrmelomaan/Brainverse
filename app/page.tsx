import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ownerId } from '@/auth';
import { hasDatabase, loadUniverse } from '@/db';
import Canvas from '@/components/Canvas';
import type { Note, Prefs } from '@/lib/model';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const owner = await ownerId();
  if (!owner) redirect('/login');
  let initial: { notes: Note[]; prefs: Prefs; synced: boolean } = { notes: [], prefs: { view: 'category', rails: { _un: false, _done: false } }, synced: false };
  if (hasDatabase()) {
    try { initial = { ...(await loadUniverse(owner)), synced: true }; }
    catch (e) { console.error('loadUniverse failed, falling back to local mode', e); }
  }
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'brainverse.mooibekeken.nl'}`;
  return <Canvas initial={initial} origin={origin} />;
}
