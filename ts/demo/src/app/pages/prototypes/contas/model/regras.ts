/**
 * Regras de negócio do modelo de contas.
 *
 * Nenhum campo `b2c`/`b2b` é jamais ARMAZENADO: a classificação existe apenas
 * como retorno de função, derivada do pagador. A intenção de uso do Step 2
 * (pessoal vs empresa/equipe) mapeia para o tipo de pagador no submit — não
 * grava um "tipo de conta" separado no estado.
 */

import type {
  ClassificacaoCobranca,
  Pagador,
  PapelNaOrganizacao,
} from "./types";

/**
 * PONTO ÚNICO DE MUDANÇA DA REGRA DE COBRANÇA.
 *
 * B2C e B2B são o MESMO sistema; a única diferença é a lógica de cobrança, e
 * ela é DERIVADA DO TIPO DE PAGADOR. No cadastro, a intenção de uso do Step 2
 * escolhe o pagador (`pf` = pessoal, `pj` = empresa/equipe); a UI não expõe
 * "B2C"/"B2B" como rótulos técnicos:
 *
 *   pagador pessoa física   (CPF)  -> b2c
 *   pagador pessoa jurídica (CNPJ) -> b2b
 *
 * Se a regra mudar (ex.: passar a depender do nº de assentos), muda AQUI e em
 * nenhum outro lugar.
 */
export function classificarCobranca(
  pagador: Pick<Pagador, "tipo">,
): ClassificacaoCobranca {
  return pagador.tipo === "pf" ? "b2c" : "b2b";
}

/**
 * Em conta B2C o workspace tem um único usuário, que é automaticamente admin e
 * NÃO pode convidar mais ninguém. Derivado — nunca um flag armazenado.
 */
export function podeConvidar(pagador: Pick<Pagador, "tipo">): boolean {
  return classificarCobranca(pagador) === "b2b";
}

/** B2C: exatamente um usuário. B2B: sem limite. */
export function limiteDeUsuarios(pagador: Pick<Pagador, "tipo">): number {
  return classificarCobranca(pagador) === "b2c"
    ? 1
    : Number.POSITIVE_INFINITY;
}

/**
 * Rótulo do papel. As regras de negócio dizem "usuário comum"; o seletor de
 * repositório pede o rótulo curto "Usuário" — daí as duas formas.
 */
export function rotuloPapel(
  papel: PapelNaOrganizacao,
  forma: "chip" | "prosa" = "chip",
): string {
  if (papel === "admin") return forma === "chip" ? "Admin" : "Administrador";
  return forma === "chip" ? "Usuário" : "Usuário comum";
}

/** Rótulo do tipo de pagador, para leitura humana. */
export function rotuloPagador(tipo: Pagador["tipo"]): string {
  return tipo === "pf" ? "Pessoa física (CPF)" : "Pessoa jurídica (CNPJ)";
}

/**
 * Texto explicativo do motivo pelo qual convites estão indisponíveis. Usado
 * como `title` nos elementos desabilitados (padrão do produto).
 */
export const MOTIVO_SEM_CONVITES =
  "Workspaces com pagador pessoa física têm um único usuário, que já é admin.";

/** Motivo padrão de funcionalidade ainda não liberada. */
export const MOTIVO_EM_BREVE = "Em breve — não disponível nesta versão.";
