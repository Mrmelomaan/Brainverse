// Next.js 16 proxy (formerly middleware): every route except static assets goes through Auth.js.
// Built from the database-free config so no pg/drizzle code runs here; the invite list is checked by ownerId().
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
