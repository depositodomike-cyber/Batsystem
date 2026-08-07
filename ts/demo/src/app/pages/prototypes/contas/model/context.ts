/**
 * Contexto do protótipo + hooks de leitura.
 *
 * Separado do `Provider.tsx` seguindo a convenção do repositório
 * (`@/app/contexts/companies` faz o mesmo): o componente vive num arquivo, o
 * contexto e os hooks noutro, para o fast refresh funcionar.
 *
 * Deliberadamente NÃO usa `CompaniesProvider` nem `AuthProvider` reais: o modelo
 * atual tem `Usuario.empresaId` (uma única organização) e `Empresa` misturando
 * tenant + pagador + plano, que são exatamente os pontos que este protótipo
 * propõe mudar. Estado próprio, isolado, descartável.
 */

import { createSafeContext } from "@/utils/createSafeContext";

import { limpar } from "./persistencia";
import type { AcaoPrototipo } from "./reducer";
import {
  capacidades,
  gruposDeRepositorios,
  organizacaoAtiva,
  organizacoesDoUsuario,
  pagadorDaOrganizacaoAtiva,
  papelEfetivo,
  papelReal,
  repositorioAtivo,
  repositoriosDoEscopoAtivo,
  usuarioDaSessao,
} from "./selectors";
import type { EstadoPrototipo } from "./types";

export interface ValorContextoPrototipo {
  estado: EstadoPrototipo;
  despachar: (acao: AcaoPrototipo) => void;
}

export const [PrototipoContasContext, usePrototipoContas] =
  createSafeContext<ValorContextoPrototipo>(
    "usePrototipoContas deve ser usado dentro de PrototipoContasProvider",
  );

/** Reinicia o protótipo: volta às fixtures e limpa o armazenamento. */
export function useReiniciarPrototipo() {
  const { despachar } = usePrototipoContas();
  return () => {
    limpar();
    despachar({ tipo: "prototipo/reiniciar" });
  };
}

// ----------------------------------------------------------------------
// Hooks de conveniência — as telas nunca mexem no estado cru.

export function useUsuario() {
  const { estado } = usePrototipoContas();
  return usuarioDaSessao(estado);
}

export function useRepositorioAtivo() {
  const { estado } = usePrototipoContas();
  return repositorioAtivo(estado);
}

export function useOrganizacaoAtiva() {
  const { estado } = usePrototipoContas();
  return organizacaoAtiva(estado);
}

export function usePagadorAtivo() {
  const { estado } = usePrototipoContas();
  return pagadorDaOrganizacaoAtiva(estado);
}

/** Papel efetivo (com override de demonstração). Null em escopo pessoal. */
export function usePapelEfetivo() {
  const { estado } = usePrototipoContas();
  return papelEfetivo(estado);
}

/** Papel real, vindo da membership — ignora o override. */
export function usePapelReal() {
  const { estado } = usePrototipoContas();
  return papelReal(estado);
}

/** Fonte única de permissão — usada pelo menu, pelos guards e pelas páginas. */
export function useCapacidades() {
  const { estado } = usePrototipoContas();
  return capacidades(estado);
}

/** Contextos da organização aberta agora — usado pelo item "Contexto". */
export function useRepositoriosDoEscopoAtivo() {
  const { estado } = usePrototipoContas();
  return repositoriosDoEscopoAtivo(estado);
}

export function useGruposDeRepositorios() {
  const { estado } = usePrototipoContas();
  return gruposDeRepositorios(estado);
}

export function useOrganizacoesDoUsuario() {
  const { estado } = usePrototipoContas();
  return organizacoesDoUsuario(estado);
}
