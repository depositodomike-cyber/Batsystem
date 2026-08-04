// Prompt do "Melhorar texto" — portado do beculture/Confi (lib/claude.js,
// melhorarTexto). Reescreve um texto para ficar mais claro e forte, sem mudar o
// sentido. Devolve JSON { texto, resumo, conexoes }.
//
// `conexoes` fica em campo separado de propósito: o texto melhorado é o que o
// usuário copia (e o que volta para o textarea numa nova rodada), então o bloco
// "## 🔗 Conexões no Vault" só é anexado à nota ao salvar na Memória.

import {
  blocoTitulosVault,
  normalizarConexoes,
  regraConexoesVaultCampo,
  separarConexoes,
} from '../conexoes-vault';

export const SYSTEM_MELHORAR = `Você é um editor de texto exigente, escrevendo em português do Brasil.
Você recebe um TEXTO e (opcionalmente) INSTRUÇÕES. Reescreva o texto para ficar mais claro, forte e agradável de ler, SEM mudar o sentido nem inventar fatos.

O que fazer:
- Corrija gramática, ortografia e pontuação.
- Deixe as frases mais diretas e a voz mais ativa. Corte redundância e enrolação.
- Preserve o tom, a intenção e o formato do original (se é um e-mail, continua e-mail; se é lista, continua lista; mantém Markdown se houver).
- Preserve o idioma do texto original.
- Se houver INSTRUÇÕES, siga-as (ex.: deixar mais formal, mais curto, mais persuasivo).

PROIBIDO clichê de IA: "no mundo de hoje", "em um mundo cada vez mais", "não é apenas… é", "descubra como", "revolucionar", "elevar ao próximo nível". Não adicione preâmbulo, comentários nem aspas em volta.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "texto": "o texto reescrito e melhorado (mesmo formato/idioma do original)", "resumo": "uma frase curta com as principais mudanças", "conexoes": "O bloco de Conexões no Vault em Markdown" }

O campo "texto" NÃO leva o bloco de conexões — ele fica só no campo "conexoes".${regraConexoesVaultCampo('conexoes')}`;

export interface Melhorado {
  texto: string;
  resumo: string;
  /** Bloco "## 🔗 Conexões no Vault" — anexado à nota ao salvar na Memória. */
  conexoes: string;
}

export function buildMelhorarUser(
  texto: string,
  instrucoes = '',
  titulosVault: string[] = [],
): string {
  return (
    `## TEXTO\n${texto.slice(0, 40000)}\n` +
    (instrucoes.trim() ? `\n## INSTRUÇÕES\n${instrucoes.trim()}\n` : '') +
    blocoTitulosVault(titulosVault) +
    `\nMelhore o texto no formato JSON pedido, com o campo "conexoes" preenchido.`
  );
}

/** Extrai o texto melhorado, com fallback robusto (texto cru). */
export function parseMelhorado(raw: string, original: string): Melhorado {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(semFence.slice(first, last + 1)) as Record<string, unknown>;
      const texto = String(obj.texto || '').trim();
      if (texto) {
        const partido = separarConexoes(texto);
        return {
          texto: partido.corpo || texto,
          resumo: String(obj.resumo || '').slice(0, 400),
          conexoes:
            normalizarConexoes(String(obj.conexoes || '')) ||
            normalizarConexoes(partido.conexoes),
        };
      }
    } catch {
      /* fallback abaixo */
    }
  }
  // Fallback: usa o texto cru (sem cercas) como resultado.
  const partido = separarConexoes((fence ? fence[1] : txt).trim());
  return {
    texto: partido.corpo || original,
    resumo: '',
    conexoes: normalizarConexoes(partido.conexoes),
  };
}
