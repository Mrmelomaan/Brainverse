import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

/** Comma-separated list of Google account emails allowed in. Everyone else is denied. */
export const allowedEmails = () =>
  (process.env.OWNER_EMAIL ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isAllowed = (email?: string | null) => !!email && allowedEmails().includes(email.toLowerCase());

/** Local development only: `DEV_LOGIN=1 npm run dev` adds a passwordless "enter as owner" door.
 *  `next build` runs with NODE_ENV=production, so this can never be active on Vercel. */
export const devLogin = () => process.env.NODE_ENV === 'development' && process.env.DEV_LOGIN === '1';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ authorization: { params: { prompt: 'select_account' } } }),
    ...(devLogin() ? [Credentials({ id: 'dev', name: 'Dev', credentials: {}, authorize: () => ({ id: 'dev', email: allowedEmails()[0], name: 'Dev owner' }) })] : []),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  callbacks: {
    // Single-owner gate: only the allowlisted, verified Google account may sign in.
    signIn({ account, profile }) {
      if (account?.provider === 'dev') return devLogin();
      if (account?.provider !== 'google') return false;
      const p = profile as { email?: string; email_verified?: boolean } | undefined;
      return !!p?.email_verified && isAllowed(p.email);
    },
    jwt({ token }) {
      // Re-check on every token refresh so removing the email from OWNER_EMAIL locks the door.
      if (!isAllowed(token.email)) return null;
      return token;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === '/login') return true;
      const ok = !!auth?.user?.email && isAllowed(auth.user.email);
      if (!ok && pathname.startsWith('/api/')) return Response.json({ error: 'unauthorized' }, { status: 401 });
      return ok;
    },
  },
});

/** Owner key used to scope every database row. */
export async function ownerId(): Promise<string | null> {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  return email && isAllowed(email) ? email : null;
}
