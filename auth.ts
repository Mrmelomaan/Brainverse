import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { isAllowedEmail, recordAccessRequest, touchUser } from '@/db';

/** Local development only: `DEV_LOGIN=1 npm run dev` adds a passwordless "enter as dev owner" door.
 *  `next build` runs with NODE_ENV=production, so this can never be active on Vercel. */
export const devLogin = () => process.env.NODE_ENV === 'development' && process.env.DEV_LOGIN === '1';
const DEV_ID = 'dev-owner';
const devEmail = () => (process.env.DEV_EMAIL ?? 'dev@localhost').toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    ...(devLogin() ? [Credentials({ id: 'dev', name: 'Dev', credentials: {}, authorize: () => ({ id: DEV_ID, email: devEmail(), name: 'Dev owner' }) })] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /** Any verified Google account gets a session. Bookkeeping decides which room it lands in:
     *  on the list → users; not on the list → access_requests (the waiting room). */
    async signIn({ account, profile, user }) {
      if (account?.provider === 'dev') return devLogin();
      if (account?.provider !== 'google') return false;
      const p = profile as { sub?: string; email?: string; email_verified?: boolean; name?: string } | undefined;
      const sub = p?.sub ?? user.id;
      const email = p?.email?.toLowerCase();
      if (!sub || !email || !p?.email_verified) return false;
      const who = { id: sub, email, name: p.name ?? user.name ?? null };
      try {
        if (await isAllowedEmail(email)) await touchUser(who);
        else await recordAccessRequest(who);
      } catch (e) {
        console.error('signIn bookkeeping failed', e);
      }
      return true;
    },
  },
});

export type Viewer = { id: string; email: string; name: string | null };

/** Whoever holds the current session, allowed or not. */
export async function viewer(): Promise<Viewer | null> {
  const s = await auth();
  const id = s?.user?.id;
  const email = s?.user?.email?.toLowerCase();
  if (!id || !email) return null;
  return { id, email, name: s.user?.name ?? null };
}

export const isDevOwner = (v: Viewer) => devLogin() && v.id === DEV_ID;

/** Is this session allowed in right now? Checked against the invite list on every data request, so
 *  removing an email locks the door without waiting for the session to expire. */
export async function isAllowedViewer(v: Viewer): Promise<boolean> {
  return isDevOwner(v) || (await isAllowedEmail(v.email));
}

/** Owner key (Google `sub`) used to scope every database row, or null when the session may not enter. */
export async function ownerId(): Promise<string | null> {
  const v = await viewer();
  if (!v) return null;
  return (await isAllowedViewer(v)) ? v.id : null;
}
