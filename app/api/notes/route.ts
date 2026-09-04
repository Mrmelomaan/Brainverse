import { NextResponse } from 'next/server';
import { ownerId } from '@/auth';
import { loadUniverse, upsertNotes } from '@/db';
import { parseNote, tooLarge } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const u = await loadUniverse(owner);
    return NextResponse.json({ synced: true, ...u });
  } catch (e) {
    console.error('notes GET', e);
    return NextResponse.json({ synced: false, reason: 'database-error' }, { status: 503 });
  }
}

/** Upsert one note or an array of notes. */
export async function PUT(req: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (tooLarge(req)) return NextResponse.json({ error: 'too large' }, { status: 413 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const items = (Array.isArray(body) ? body : [body]).slice(0, 500).map(parseNote);
  if (items.some((n) => !n)) return NextResponse.json({ error: 'invalid note' }, { status: 400 });
  try {
    await upsertNotes(owner, items as NonNullable<(typeof items)[number]>[]);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    console.error('notes PUT', e);
    return NextResponse.json({ error: 'database-error' }, { status: 503 });
  }
}
