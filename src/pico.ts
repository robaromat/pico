// Pico, le hérisson châtaigne : dessin SVG (repris de la maquette v1).
export type Expression = 'hello' | 'happy' | 'wait' | 'sleep' | 'gift' | 'idle';

export const PC = { spike: '#6E4125', body: '#B96A34', belly: '#F3D1A4', ink: '#2B1E2E', cheek: '#FF8E8E' };

function spikePts(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, n: number): string[] {
  const p: string[] = [];
  for (let i = 0; i <= 2 * n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / (2 * n)) * Math.PI) / 180;
    const r = i % 2 ? r1 : r0;
    p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return p;
}

/** Le corps de Pico, sans la balise <svg> (sert aussi aux icônes). */
export function picoArt(expr: Expression = 'idle', scarf = '#FFC22E'): string {
  const pts = [...spikePts(56, 72, 30, 47, -55, -245, 11), '56,72'].join(' ');
  let eye = `<circle cx="86" cy="67" r="4.8" fill="${PC.ink}"/><circle cx="87.7" cy="65.3" r="1.6" fill="#fff"/>`;
  if (expr === 'happy' || expr === 'gift') eye = `<path d="M81 68 q5.5 -7 11 0" stroke="${PC.ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  if (expr === 'sleep') eye = `<path d="M81 67 q5.5 5 11 0" stroke="${PC.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  let mouth = `<path d="M93 86 q5 5 10 -1" stroke="${PC.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (expr === 'happy' || expr === 'gift') mouth = `<path d="M92 84.5 q6 10 12 0 z" fill="#6B2433"/>`;
  if (expr === 'wait') mouth = `<path d="M94 87.5 h7" stroke="${PC.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (expr === 'sleep') mouth = `<path d="M95 87 q3 2.5 6 0" stroke="${PC.ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const paw =
    expr === 'hello'
      ? `<g class="wave"><ellipse cx="104" cy="56" rx="5.5" ry="7.5" fill="${PC.body}"/><ellipse cx="104" cy="54" rx="3" ry="4" fill="${PC.belly}"/></g>`
      : '';
  const gift =
    expr === 'gift'
      ? `<g><rect x="82" y="90" width="28" height="22" rx="3" fill="#E8475B"/><rect x="93" y="90" width="6" height="22" fill="#FFC22E"/><rect x="80" y="86" width="32" height="7" rx="2" fill="#F05A6D"/><path d="M96 86 q-9 -10 -12 -2 q4 4 12 2 q8 2 12 -2 q-3 -8 -12 2z" fill="#FFC22E"/></g>`
      : '';
  const zz =
    expr === 'sleep'
      ? `<text x="96" y="44" font-family="Baloo 2,sans-serif" font-weight="800" font-size="14" fill="#C9C3FF">z</text><text x="104" y="32" font-family="Baloo 2,sans-serif" font-weight="800" font-size="18" fill="#E6E1FF">Z</text>`
      : '';
  return `<polygon points="${pts}" fill="${PC.spike}"/>
  <rect x="20" y="62" width="22" height="28" rx="7" fill="#3E8E5E"/><rect x="23" y="70" width="16" height="9" rx="3" fill="#57AE78"/>
  <ellipse cx="60" cy="76" rx="36" ry="29" fill="${PC.body}"/>
  <path d="M44 66 q10 10 6 26" stroke="#2F6B48" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="81" cy="79" rx="22" ry="19" fill="${PC.belly}"/>
  <circle cx="69" cy="51" r="6.5" fill="${PC.body}"/><circle cx="69" cy="51" r="3.2" fill="${PC.belly}"/>
  <ellipse cx="98" cy="80" rx="12.5" ry="9" fill="${PC.belly}"/>
  <circle cx="109.5" cy="77.5" r="4.6" fill="${PC.ink}"/>
  ${eye}
  <circle cx="89" cy="81" r="4" fill="${PC.cheek}" opacity=".55"/>
  ${mouth}
  <ellipse cx="48" cy="103" rx="9" ry="5" fill="${PC.spike}"/><ellipse cx="74" cy="104" rx="9" ry="5" fill="${PC.spike}"/>
  <path d="M63 86 Q79 98 97 91" stroke="${scarf}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M70 92 L64 108" stroke="${scarf}" stroke-width="7" stroke-linecap="round"/>
  <path d="M65 103 l5 2" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round"/>
  ${paw}${gift}${zz}`;
}

export function pico(expr: Expression = 'idle', scarf?: string, cls = ''): string {
  return `<svg class="pico ${cls}" viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="110" rx="36" ry="5" fill="rgba(43,33,64,.12)"/>${picoArt(expr, scarf)}</svg>`;
}
