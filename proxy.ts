// Next.js 16 proxy (formerly middleware): every route except static assets goes through Auth.js.
export { auth as proxy } from '@/auth';

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
