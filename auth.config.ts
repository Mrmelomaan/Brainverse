import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/** Pages anyone may open without a session. */
export const PUBLIC_PATHS = ['/login', '/privacy'];

/**
 * The database-free half of the Auth.js setup. proxy.ts runs this on every request, so it must not
 * import pg/drizzle. The full config (auth.ts) adds the allowlist checks that need the database.
 *
 * Access model: any verified Google account may hold a session. What a session may *do* is decided by
 * `ownerId()` in auth.ts, which checks the invite list on every data request. The proxy only asks
 * "is there a session at all?" and sends the rest to /login.
 */
export const authConfig = {
  providers: [Google({ authorization: { params: { prompt: 'select_account' } } })],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (PUBLIC_PATHS.includes(pathname)) return true;
      const ok = !!auth?.user;
      if (!ok && pathname.startsWith('/api/')) return Response.json({ error: 'unauthorized' }, { status: 401 });
      return ok;
    },
  },
} satisfies NextAuthConfig;
