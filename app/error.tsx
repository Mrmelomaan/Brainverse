'use client';
// Shown when the server could not load the universe (usually: the database did not answer).
// Nothing is written while this is on screen, so nothing is lost; the last saved state is on the server.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(ellipse at 30% 20%, #1c1130 0%, #120a1f 55%, #0b0616 100%)' }}>
      <div style={{ maxWidth: 380, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, color: 'rgba(236,230,245,.7)', fontSize: 14, lineHeight: 1.5 }}>
        <div style={{ fontFamily: 'var(--font-oxygen), Oxygen, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '.28em', color: '#f3eefc' }}>BRAINVERSE</div>
        <div>The universe did not answer. Usually the database is catching its breath; your notes are safe where they were last saved.</div>
        <button type="button" onClick={() => reset()} className="bv-primary" style={{ alignSelf: 'center', fontFamily: 'var(--font-oxygen), Oxygen, sans-serif', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '12px 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#c9b8ff,#7f5cf0)', color: '#120a1f', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
      </div>
    </div>
  );
}
