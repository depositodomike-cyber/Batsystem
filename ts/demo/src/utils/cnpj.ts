/**
 * Utilidades de CNPJ: máscara para exibição e validação por dígitos
 * verificadores. Sem dependências externas.
 */

/** Mantém só dígitos e limita a 14 caracteres. */
export function onlyDigitsCnpj(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

/** Aplica a máscara 00.000.000/0000-00 conforme o usuário digita. */
export function maskCnpj(value: string): string {
  const d = onlyDigitsCnpj(value);
  let out = d;
  if (d.length > 2) out = `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length > 5) out = `${out.slice(0, 6)}.${d.slice(5)}`;
  if (d.length > 8) out = `${out.slice(0, 10)}/${d.slice(8)}`;
  if (d.length > 12) out = `${out.slice(0, 15)}-${d.slice(12)}`;
  return out;
}

/** Valida um CNPJ pelos dígitos verificadores (aceita com ou sem máscara). */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigitsCnpj(value);

  if (cnpj.length !== 14) return false;
  // Rejeita sequências repetidas (00000000000000, 11111111111111, ...).
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string): number => {
    let factor = base.length - 7;
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * factor;
      factor = factor === 2 ? 9 : factor - 1;
    }
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };

  const base12 = cnpj.slice(0, 12);
  const dig1 = calcDigit(base12);
  const dig2 = calcDigit(base12 + dig1);

  return cnpj.endsWith(`${dig1}${dig2}`);
}
