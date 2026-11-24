import { pico, type Expression } from '../pico';

/** Pico en composant (le dessin SVG vient de pico.ts). */
export function Pico({ expr = 'idle', scarf, cls = '' }: { expr?: Expression | 'ball'; scarf?: string; cls?: string }) {
  return <span class={`pico-wrap ${cls}`} dangerouslySetInnerHTML={{ __html: pico(expr === 'ball' ? 'happy' : expr, scarf, cls) }} />;
}

/** Image de Pico pour le canvas du jeu. */
export function picoImage(expr: Expression, scarf: string): HTMLImageElement {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pico(expr, scarf).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  return img;
}
