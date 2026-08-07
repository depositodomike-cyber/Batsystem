/**
 * Estado inicial do protótipo.
 *
 * Começa VAZIO de propósito: nenhuma conta, organização ou repositório. É o
 * ponto de partida para demonstrar a criação de uma conta do zero, sem cair
 * numa conta semeada. As contas passam a existir só quando alguém as cria pelo
 * fluxo de cadastro (ou quando o login sincroniza uma conta do backend).
 *
 * Para recomeçar do zero durante a demonstração, use a ação
 * `prototipo/reiniciar` (ou apague a chave do `localStorage`).
 */

import type { ConteudoRepositorio, EstadoPrototipo } from "./types";

/**
 * Senha única de exemplo para contas criadas por caminhos sem senha digitada
 * (ex.: `sessao/garantir`, que parte de uma sessão já autenticada). Atende à
 * regra do cadastro (8+ caracteres, com letra e número).
 */
export const SENHA_DEMONSTRACAO = "demonstracao1";

export function estadoSemeado(): EstadoPrototipo {
  return {
    versao: 8,
    usuarios: [],
    pagadores: [],
    organizacoes: [],
    membros: [],
    repositorios: [],
    conteudo: {},
    convites: [],
    sessao: null,
    contexto: null,
    demo: { papelForcado: null },
  };
}

/** Conteúdo vazio — repositório recém-criado. */
export function conteudoVazio(): ConteudoRepositorio {
  return { memoria: [], agrupamentos: [], insights: [] };
}
