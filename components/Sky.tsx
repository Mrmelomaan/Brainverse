'use client';
import { memo } from 'react';

export type Drifter = { kind: 'rocket' | 'satellite' | 'astronaut' | 'cat' | 'comet'; dir: 1 | -1; top: number; dur: number; delay: number; spinDir: 'normal' | 'reverse'; spinDur: number };
export type Motion = 'subtle' | 'lively' | 'off';

const rnd = (seed: number) => { let t = seed >>> 0; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; };
const r = rnd(7);
const STARS = Array.from({ length: 170 }, () => ({ x: r() * 100, y: r() * 100, s: r() < 0.85 ? 1 + r() * 1.2 : 2.2 + r() * 1.4, d: 2.5 + r() * 5, dl: -r() * 8, o: 0.35 + r() * 0.65 }));

export function makeDrifters(): Drifter[] {
  const R = Math.random; const pick = (a: number, b: number) => a + R() * (b - a);
  return (['rocket', 'satellite', 'astronaut', 'cat', 'comet'] as const).map((kind) => ({
    kind, dir: R() < 0.5 ? -1 : 1, top: pick(6, 84), dur: kind === 'comet' ? pick(80, 120) : pick(150, 260), delay: -pick(0, 200), spinDir: R() < 0.5 ? 'normal' : 'reverse', spinDur: pick(45, 110),
  }));
}

const light = '#d9d2ea', mid = '#8f86a6';
const abs = (s: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', ...s });
const SHAPES: Record<Drifter['kind'], React.ReactNode> = {
  rocket: (
    <div style={{ position: 'relative', width: 44, height: 18 }}>
      <div style={abs({ left: 10, top: 3, width: 30, height: 12, background: light, borderRadius: '6px 12px 12px 6px' })} />
      <div style={abs({ left: 27, top: 6.5, width: 5, height: 5, borderRadius: '50%', background: '#5b3fc7' })} />
      <div style={abs({ left: 8, top: 4, width: 0, height: 0, borderRight: '10px solid #b9a7ff', borderTop: '6px solid transparent', borderBottom: '6px solid transparent' })} />
      <div style={abs({ left: -2, top: 6, width: 12, height: 6, borderRadius: '50%', background: 'linear-gradient(90deg, transparent, #ffb36b)', opacity: 0.85 })} />
    </div>
  ),
  satellite: (
    <div style={{ position: 'relative', width: 56, height: 16 }}>
      <div style={abs({ left: 0, top: 4, width: 20, height: 8, background: 'oklch(70% 0.12 240)', borderRadius: 2 })} />
      <div style={abs({ left: 21, top: 1, width: 14, height: 14, background: light, borderRadius: 3 })} />
      <div style={abs({ left: 36, top: 4, width: 20, height: 8, background: 'oklch(70% 0.12 240)', borderRadius: 2 })} />
    </div>
  ),
  astronaut: (
    <div style={{ position: 'relative', width: 20, height: 36 }}>
      <div style={abs({ left: 1, top: 0, width: 18, height: 18, borderRadius: '50%', background: light })} />
      <div style={abs({ left: 5, top: 5, width: 10, height: 8, borderRadius: '50%', background: '#2a1a4d' })} />
      <div style={abs({ left: 3, top: 18, width: 14, height: 16, borderRadius: 5, background: mid })} />
    </div>
  ),
  cat: (
    <div style={{ position: 'relative', width: 22, height: 22 }}>
      <div style={abs({ left: 2, top: 6, width: 18, height: 16, borderRadius: '50% 50% 45% 45%', background: mid })} />
      <div style={abs({ left: 2, top: -1, width: 0, height: 0, borderBottom: '9px solid ' + mid, borderRight: '7px solid transparent' })} />
      <div style={abs({ left: 13, top: -1, width: 0, height: 0, borderBottom: '9px solid ' + mid, borderLeft: '7px solid transparent' })} />
      <div style={abs({ left: 7, top: 12, width: 3, height: 3, borderRadius: '50%', background: '#c9f5b8' })} />
      <div style={abs({ left: 13, top: 12, width: 3, height: 3, borderRadius: '50%', background: '#c9f5b8' })} />
    </div>
  ),
  comet: (
    <div style={{ position: 'relative', width: 110, height: 6 }}>
      <div style={abs({ left: 0, top: 2, width: 100, height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7))' })} />
      <div style={abs({ left: 100, top: 0, width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 3px rgba(255,255,255,.6)' })} />
    </div>
  ),
};

/** Stars, planet and drifters. Parallax follows the canvas pan. */
export const Sky = memo(function Sky({ panX, panY, vw, vh, drifters, motion = 'subtle' }: { panX: number; panY: number; vw: number; vh: number; drifters: Drifter[]; motion?: Motion }) {
  const speed = motion === 'lively' ? 0.35 : 1;
  const twinkle = motion !== 'off';
  return (
    <>
      <div style={{ position: 'absolute', inset: '-20%', transform: `translate(${panX * 0.12}px,${panY * 0.12}px)`, pointerEvents: 'none' }}>
        {STARS.map((s, i) => (
          <div key={i} className="bv-star" style={{ position: 'absolute', left: s.x + '%', top: s.y + '%', width: s.s, height: s.s, borderRadius: '50%', background: '#fff', opacity: s.o, boxShadow: s.s > 2 ? '0 0 6px 1px rgba(255,255,255,.6)' : 'none', animation: twinkle ? `bv-tw ${s.d}s ease-in-out ${s.dl}s infinite` : 'none' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: -120, bottom: -160, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, oklch(48% 0.14 300) 0%, oklch(30% 0.1 290) 45%, #0d0716 100%)', boxShadow: '0 0 80px rgba(150,110,255,.15), inset -40px -30px 80px rgba(0,0,0,.6)', transform: `translate(${panX * 0.05}px,${panY * 0.05}px)`, opacity: 0.9, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 560, height: 120, marginLeft: -280, marginTop: -60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.14)', transform: 'rotate(-18deg)', boxShadow: '0 0 20px rgba(201,184,255,.15)' }} />
      </div>
      {drifters.map((d) => {
        const comet = d.kind === 'comet';
        const anim = comet ? (d.dir > 0 ? 'bv-diagR' : 'bv-diagL') : d.dir > 0 ? 'bv-driftR' : 'bv-driftL';
        const inner: React.CSSProperties = comet
          ? { transform: `rotate(${(Math.atan2(0.55 * vh, d.dir * 1.4 * vw) * 180) / Math.PI}deg)` }
          : { animation: motion === 'off' ? 'none' : `bv-spin ${d.spinDur * speed}s linear infinite ${d.spinDir}` };
        return (
          <div key={d.kind} className="bv-drifter" style={{ position: 'absolute', left: 0, top: comet ? '0%' : d.top + '%', pointerEvents: 'none', opacity: 0.55, animation: `${anim} ${d.dur * speed}s linear ${d.delay}s infinite` }}>
            <div style={inner}>{SHAPES[d.kind]}</div>
          </div>
        );
      })}
    </>
  );
});
