'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { Sky, makeDrifters } from '@/components/Sky';

const subscribe = (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); };
const snap = () => `${window.innerWidth}x${window.innerHeight}`;

export function LoginSky() {
  const size = useSyncExternalStore(subscribe, snap, () => 'ssr');
  const isClient = size !== 'ssr';
  const [vw, vh] = isClient ? size.split('x').map(Number) : [1280, 800];
  const drifters = useMemo(() => (isClient ? makeDrifters() : []), [isClient]);
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}><Sky panX={0} panY={0} vw={vw} vh={vh} drifters={drifters} /></div>;
}
