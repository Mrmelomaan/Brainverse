import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAllowedViewer, signOut, viewer } from '@/auth';
import { clearAccessRequest, touchUser } from '@/db';
import { LoginSky } from '../login/LoginSky';

export const dynamic = 'force-dynamic';
const OX = 'var(--font-oxygen), Oxygen, sans-serif';
const LINKEDIN = 'https://www.linkedin.com/in/rob-webdesign-fotografie-nijmegen/';

/** The waiting room. A signed-in account that is not on the invite list lands here; a reload after
 *  Rob adds the email walks straight through. */
export default async function Waiting() {
  const v = await viewer();
  if (!v) redirect('/login');
  if (await isAllowedViewer(v)) {
    await touchUser(v);
    await clearAccessRequest(v.id);
    redirect('/');
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, #1c1130 0%, #120a1f 55%, #0b0616 100%)', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 24 }}>
      <LoginSky />
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, borderRadius: 24, padding: '28px 26px 22px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', animation: 'bv-pop .3s ease-out', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: OX, fontWeight: 700, fontSize: 16, letterSpacing: '.28em', color: '#f3eefc', textShadow: '0 0 18px rgba(201,184,255,.55)' }}>BRAINVERSE</div>
        <div style={{ fontFamily: OX, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#c9b8ff' }}>Invite only, for now</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(236,230,245,.7)' }}>
          You signed in as <span style={{ color: '#f3eefc', wordBreak: 'break-all' }}>{v.email}</span>, and that address is not on the list yet.
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(236,230,245,.7)' }}>
          Send <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" style={{ color: '#c9b8ff', textDecoration: 'none', borderBottom: '1px solid rgba(201,184,255,.4)' }}>Rob</a> a message and mention that address. He adds people by hand, so give it a moment. Once he has, just reload this page.
        </div>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}>
          <button type="submit" className="bv-pill" style={{ fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', color: 'rgba(236,230,245,.75)', cursor: 'pointer' }}>Sign out</button>
        </form>
        <div style={{ fontFamily: OX, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(236,230,245,.35)' }}>
          <Link href="/privacy" style={{ color: 'rgba(236,230,245,.5)', textDecoration: 'none' }}>What we keep about you</Link>
        </div>
      </div>
    </div>
  );
}
