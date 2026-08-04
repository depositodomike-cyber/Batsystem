// Checagem de contraste WCAG — portado do beculture/Confi (design-system.js).
// Usada no editor para avisar quando um par de cores reprova.

function luminancia(hex: string): number {
  const m = /^#?([\da-f]{6})$/i.exec(hex || "");
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Razão de contraste entre duas cores hex (1:1 a 21:1). */
export function contraste(a: string, b: string): number {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Nível WCAG da razão: AAA, AA, AA grande ou reprovado. */
export function nivel(r: number): { txt: string; ok: boolean } {
  if (r >= 7) return { txt: "AAA", ok: true };
  if (r >= 4.5) return { txt: "AA", ok: true };
  if (r >= 3) return { txt: "AA grande", ok: true };
  return { txt: "Reprovado", ok: false };
}
