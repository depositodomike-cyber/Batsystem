/**
 * Persistência do estado do protótipo em `localStorage`.
 *
 * Era `sessionStorage`, e isso apagava as contas criadas quando a aba fechava:
 * o e-mail usado para entrar deixava de existir e o login respondia "nenhuma
 * conta com este e-mail". Como o `authToken` do protótipo já vive em
 * `localStorage`, guardar o estado no mesmo lugar mantém sessão e contas com o
 * mesmo tempo de vida.
 *
 * Para começar do zero, use a ação `prototipo/reiniciar` (ou apague a chave).
 */

import { estadoSemeado } from "./fixtures";
import type { EstadoPrototipo } from "./types";

/**
 * v8: descarta as contas e as organizações criadas durante os testes. Contas
 * apagadas no backend não somem daqui sozinhas — organizações e contextos só
 * existem neste armazenamento —, então trocar a chave é o que devolve a
 * demonstração ao zero em TODO navegador, não só no que foi limpo à mão.
 */
const CHAVE = "proto:contas:v8";
const CHAVES_LEGADAS = [
  "proto:contas:v1",
  "proto:contas:v2",
  "proto:contas:v3",
  "proto:contas:v4",
  "proto:contas:v5",
  "proto:contas:v6",
  "proto:contas:v7",
];
const VERSAO = 8;

function descartarLegado(): void {
  for (const chave of CHAVES_LEGADAS) {
    sessionStorage.removeItem(chave);
    localStorage.removeItem(chave);
  }
}

export function carregar(): EstadoPrototipo {
  try {
    descartarLegado();

    const cru = localStorage.getItem(CHAVE);
    if (!cru) return estadoSemeado();

    const salvo = JSON.parse(cru) as Partial<EstadoPrototipo>;
    if (salvo.versao !== VERSAO) return estadoSemeado();

    return salvo as EstadoPrototipo;
  } catch {
    return estadoSemeado();
  }
}

export function salvar(estado: EstadoPrototipo): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Modo privativo / cota cheia: o protótipo segue funcionando em memória.
  }
}

export function limpar(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Ignorado — ver acima.
  }
}
