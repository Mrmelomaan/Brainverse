import { ICONS, type IconName } from '@/lib/icons';
import type { CSSProperties } from 'react';

/** Inline Hugeicons glyph (bundled, no runtime fetch). */
export function Icon({ name, size = 16, color = '#f3eefc', style, title }: { name: IconName; size?: number; color?: string; style?: CSSProperties; title?: string }) {
  const ic = ICONS[name];
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${ic.w} ${ic.h}`} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
      style={{ flex: 'none', color, display: 'block', ...style }} dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + ic.body }}
    />
  );
}
