import { NextResponse } from 'next/server';
import { ownerId, viewer } from '@/auth';
import { deleteAccount } from '@/db';

export const dynamic = 'force-dynamic';

/** Delete-my-account: notes, prefs, user row and the invite itself. The client signs out afterwards. */
export async function DELETE() {
  const owner = await ownerId();
  const v = await viewer();
  if (!owner || !v) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await deleteAccount(owner, v.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('account DELETE', e);
    return NextResponse.json({ error: 'database-error' }, { status: 503 });
  }
}
