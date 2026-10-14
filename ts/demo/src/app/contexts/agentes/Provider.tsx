import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { useAuthContext } from "@/app/contexts/auth/context";
import { useDonoRepositorio } from "@/app/pages/ceo/repositorio-org/useDocumentosOrg";
import {
  chaveMencao,
  listarAgentesApi,
  type AgentePessoal,
} from "@/services/api/agentes";
import {
  AgentesContext,
  type AgenteMencionavel,
  type AgentesContextValue,
} from "./context";

// ----------------------------------------------------------------------
// Fonte única dos agentes mencionáveis (@) — do sistema, da organização ativa
// e do usuário. Lido por todo lugar que lista, menciona ou identifica um
// agente: autocomplete do composer, respostas no chat, histórico e as telas de
// Agentes (Configurações de usuário e da organização).
//
// Os agentes da organização dependem da organização ativa: trocar de
// organização recarrega a lista.

/** Token "@Algo" precedido de início ou espaço (evita casar com e-mail). */
const MENCAO = /(^|\s)@([\p{L}\p{N}]+)/gu;

function personalizado(
  a: AgentePessoal,
  tipo: "organizacao" | "pessoal",
): AgenteMencionavel {
  return {
    id: a.id,
    titulo: a.titulo,
    mencao: a.mencao,
    tipo,
    icone: a.icone ?? null,
    descricao: a.descricao,
  };
}

export function AgentesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const dono = useDonoRepositorio();
  const [sistema, setSistema] = useState<AgenteMencionavel[]>([]);
  const [organizacao, setOrganizacao] = useState<AgenteMencionavel[]>([]);
  const [meus, setMeus] = useState<AgenteMencionavel[]>([]);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await listarAgentesApi(dono);
      setSistema(
        r.sistema.map((a) => ({
          id: a.id,
          titulo: a.titulo,
          mencao: a.mencao,
          tipo: "sistema" as const,
          icone: a.icone,
          descricao: a.descricao,
        })),
      );
      setOrganizacao(r.organizacao.map((a) => personalizado(a, "organizacao")));
      setMeus(r.meus.map((a) => personalizado(a, "pessoal")));
    } catch {
      // Sem a lista, o Assistente segue funcionando sem agentes.
    } finally {
      setCarregando(false);
    }
  }, [dono]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // IIFE: o setState acontece depois do await, fora do corpo do efeito.
    void (async () => {
      await recarregar();
    })();
  }, [isAuthenticated, recarregar]);

  const todos = useMemo(
    () => [...sistema, ...organizacao, ...meus],
    [sistema, organizacao, meus],
  );

  const porId = useCallback(
    (id: string) => todos.find((a) => a.id === id),
    [todos],
  );

  const encontrarMencoes = useCallback(
    (texto: string) => {
      const porChave = new Map(todos.map((a) => [chaveMencao(a.mencao), a]));
      const achados: AgenteMencionavel[] = [];
      for (const m of texto.matchAll(MENCAO)) {
        const agente = porChave.get(chaveMencao(m[2]));
        if (agente && !achados.includes(agente)) achados.push(agente);
      }
      return achados;
    },
    [todos],
  );

  const value = useMemo<AgentesContextValue>(
    () => ({
      sistema: isAuthenticated ? sistema : [],
      organizacao: isAuthenticated ? organizacao : [],
      meus: isAuthenticated ? meus : [],
      todos: isAuthenticated ? todos : [],
      carregando,
      recarregar,
      porId,
      encontrarMencoes,
    }),
    [
      isAuthenticated,
      sistema,
      organizacao,
      meus,
      todos,
      carregando,
      recarregar,
      porId,
      encontrarMencoes,
    ],
  );

  return <AgentesContext value={value}>{children}</AgentesContext>;
}
