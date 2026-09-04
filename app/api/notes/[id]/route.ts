import { NextResponse } from 'next/server';
import { ownerId } from '@/auth';
import { deleteNote } from '@/db';
import { isId } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  if (!isId(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    await deleteNote(owner, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('notes DELETE', e);
    return NextResponse.json({ error: 'database-error' }, { status: 503 });
  }
}
