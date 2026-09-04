import { NextResponse } from 'next/server';
import { ownerId } from '@/auth';
import { savePrefs } from '@/db';
import { parsePrefs, tooLarge } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (tooLarge(req)) return NextResponse.json({ error: 'too large' }, { status: 413 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const p = parsePrefs(body);
  if (!p) return NextResponse.json({ error: 'invalid prefs' }, { status: 400 });
  try {
    await savePrefs(owner, p);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('prefs PUT', e);
    return NextResponse.json({ error: 'database-error' }, { status: 503 });
  }
}
