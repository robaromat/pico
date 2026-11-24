/** Identifiant court et aléatoire, ex. « i_3f9a1c07be ». */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
