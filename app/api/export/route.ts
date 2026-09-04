import { NextResponse } from 'next/server';
import { ownerId, viewer } from '@/auth';
import { loadUniverse } from '@/db';

export const dynamic = 'force-dynamic';

/** Everything this account has, as one downloadable JSON file. */
export async function GET() {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const v = await viewer();
    const u = await loadUniverse(owner);
    const body = { app: 'brainverse', version: 1, exportedAt: new Date().toISOString(), account: v?.email ?? null, ...u };
    const stamp = body.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(body, null, 1), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="brainverse-${stamp}.json"`, 'cache-control': 'no-store' },
    });
  } catch (e) {
    console.error('export GET', e);
    return NextResponse.json({ error: 'database-error' }, { status: 503 });
  }
}
