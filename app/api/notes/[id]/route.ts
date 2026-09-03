import { NextResponse } from 'next/server';
import { ownerId } from '@/auth';
import { deleteNote, hasDatabase } from '@/db';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'no-database' }, { status: 503 });
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    await deleteNote(owner, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('notes DELETE', e);
    return NextResponse.json({ error: 'database-error' }, { status: 503 });
  }
}
