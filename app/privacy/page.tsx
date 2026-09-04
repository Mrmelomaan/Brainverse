import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy · Brainverse' };
const OX = 'var(--font-oxygen), Oxygen, sans-serif';
const LINKEDIN = 'https://www.linkedin.com/in/rob-webdesign-fotografie-nijmegen/';

/** Plain-language privacy notice. Written for the people who actually use this: friends and contacts of Rob. */
export default function Privacy() {
  const h = (t: string) => <h2 style={{ fontFamily: OX, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#c9b8ff', margin: '26px 0 8px' }}>{t}</h2>;
  const p = (t: React.ReactNode) => <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.6, color: 'rgba(236,230,245,.75)' }}>{t}</p>;
  const a = (href: string, t: string) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#c9b8ff', textDecoration: 'none', borderBottom: '1px solid rgba(201,184,255,.4)' }}>{t}</a>;
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'radial-gradient(ellipse at 30% 20%, #1c1130 0%, #120a1f 55%, #0b0616 100%)', padding: '48px 20px 80px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontFamily: OX, fontWeight: 700, fontSize: 16, letterSpacing: '.28em', color: '#f3eefc', textShadow: '0 0 18px rgba(201,184,255,.55)', marginBottom: 6 }}>BRAINVERSE</div>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 6px', color: '#f3eefc' }}>Privacy, in plain words</h1>
        <div style={{ fontSize: 12.5, color: 'rgba(236,230,245,.45)' }}>Last updated 4 September 2026</div>

        {p(<>Brainverse is a small, invite-only notes app made by Rob Huttinga (Mooi Bekeken, Nijmegen, the Netherlands). It is in beta and free. This page says what it keeps about you and why, so you can decide whether you want to put your thoughts in it.</>)}

        {h('What is stored')}
        {p(<><strong style={{ color: '#f3eefc', fontWeight: 500 }}>Your notes.</strong> Everything you type: note text, comments, the life area, project and priority you give a note, whether it is done, and when it was created or changed.</>)}
        {p(<><strong style={{ color: '#f3eefc', fontWeight: 500 }}>Your Google account basics.</strong> When you sign in with Google we receive your email address, your name and a permanent account id from Google. We keep those three things. We do not receive your password, your contacts, your calendar or anything else in your Google account. The calendar button only opens Google Calendar in a new tab with a prefilled event; nothing is written to your calendar by us.</>)}
        {p(<><strong style={{ color: '#f3eefc', fontWeight: 500 }}>Your settings.</strong> Which view you last used, which rails are collapsed, and the projects you created.</>)}
        {p(<><strong style={{ color: '#f3eefc', fontWeight: 500 }}>If you are not on the list yet.</strong> When someone signs in who has not been invited, we keep their email, name, Google id and the times they tried, so Rob can see who is waiting. That record is removed when they are added or when they delete their account.</>)}
        {p(<>There is no analytics, no advertising, no tracking pixel and no third-party script on the page. The only cookie is the one that keeps you signed in.</>)}

        {h('Why')}
        {p(<>To run the app you asked to use: show you your own notes and nobody else&apos;s, keep you signed in, and let Rob manage who gets in. That is the legal basis (performing the service you requested). Nothing is used for any other purpose, and nothing is sold or shared.</>)}

        {h('Where')}
        {p(<>Notes and account data live in a Postgres database hosted by {a('https://neon.tech/privacy-policy', 'Neon')} in Frankfurt, Germany (EU). The app itself runs on {a('https://vercel.com/legal/privacy-policy', 'Vercel')}, also in Frankfurt. Both companies process data on Rob&apos;s behalf under their standard data processing agreements. Your data does not leave the EU for storage.</>)}

        {h('How long')}
        {p(<>Until you delete it. Deleting a note removes it from the database right away. Deleting your account (in the menu under your name) removes all your notes, settings, your account record and your invite in one go. Database backups made for safety are kept for a limited time and then overwritten.</>)}

        {h('Your rights')}
        {p(<>You can see everything we hold about you at any time: the menu has an <strong style={{ color: '#f3eefc', fontWeight: 500 }}>Export</strong> button that downloads it all as one file. You can delete it all yourself with <strong style={{ color: '#f3eefc', fontWeight: 500 }}>Delete account</strong>. For anything else (a correction, a question, an objection) message Rob directly; you have his number, or reach him on {a(LINKEDIN, 'LinkedIn')} or at hallo@mooibekeken.nl. You also have the right to complain to the Dutch data protection authority, the Autoriteit Persoonsgegevens.</>)}

        {h('If something goes wrong')}
        {p(<>Brainverse is a beta run by one person. Please export your notes now and then. If the database were ever lost or leaked, Rob will tell everyone who is affected personally and without delay, and report it to the Autoriteit Persoonsgegevens where the law requires it.</>)}

        <div style={{ marginTop: 36, fontFamily: OX, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase' }}>
          <Link href="/" style={{ color: 'rgba(236,230,245,.5)', textDecoration: 'none' }}>Back to the universe</Link>
        </div>
      </div>
    </div>
  );
}
