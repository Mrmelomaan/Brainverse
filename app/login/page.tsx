import { redirect } from 'next/navigation';
import { auth, devLogin, isAllowed, signIn } from '@/auth';
import { Icon } from '@/components/Icon';
import { LoginSky } from './LoginSky';

export const dynamic = 'force-dynamic';
const OX = 'var(--font-oxygen), Oxygen, sans-serif';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user?.email && isAllowed(session.user.email)) redirect('/');
  const { error } = await searchParams;
  const configured = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
  const msg = error === 'AccessDenied' ? 'That Google account is not the owner of this universe.' : error ? 'Sign-in did not go through. Try again.' : null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, #1c1130 0%, #120a1f 55%, #0b0616 100%)', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 24 }}>
      <LoginSky />
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, borderRadius: 24, padding: '28px 26px 24px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', animation: 'bv-pop .3s ease-out', display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'center' }}>
        <div style={{ fontFamily: OX, fontWeight: 700, fontSize: 16, letterSpacing: '.28em', color: '#f3eefc', textShadow: '0 0 18px rgba(201,184,255,.55)' }}>BRAINVERSE</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(236,230,245,.6)' }}>A private universe. One door, one key.</div>
        {configured ? (
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
            <button type="submit" className="bv-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '14px 20px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#c9b8ff,#7f5cf0)', color: '#120a1f', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 24px rgba(169,140,255,.4)' }}>
              <Icon name="google" size={16} color="#120a1f" /> Continue with Google
            </button>
          </form>
        ) : (
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#ff9a9a', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,154,154,.08)', border: '1px solid rgba(255,154,154,.25)' }}>
            Google login is not configured yet. Set AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and AUTH_SECRET.
          </div>
        )}
        {msg && <div style={{ fontSize: 12.5, color: '#ff9a9a' }}>{msg}</div>}
        {devLogin() && (
          <form action={async () => { 'use server'; await signIn('dev', { redirectTo: '/' }); }}>
            <button type="submit" className="bv-pill" style={{ fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', color: 'rgba(236,230,245,.75)', cursor: 'pointer' }}>Dev login (local only)</button>
          </form>
        )}
      </div>
    </div>
  );
}
