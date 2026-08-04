/**
 * Utilidades de CPF: máscara para exibição e validação por dígitos
 * verificadores. Sem dependências externas.
 */

/** Mantém só dígitos e limita a 11 caracteres. */
export function onlyDigitsCpf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Aplica a máscara 000.000.000-00 conforme o usuário digita. */
export function maskCpf(value: string): string {
  const d = onlyDigitsCpf(value);
  let out = d;
  if (d.length > 3) out = `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length > 6) out = `${out.slice(0, 7)}.${d.slice(6)}`;
  if (d.length > 9) out = `${out.slice(0, 11)}-${d.slice(9)}`;
  return out;
}

/** Valida um CPF pelos dígitos verificadores (aceita com ou sem máscara). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigitsCpf(value);

  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111..., ...).
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(cpf[i]) * (len + 1 - i);
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}
