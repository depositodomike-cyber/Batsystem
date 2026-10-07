import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { useAuthContext } from "@/app/contexts/auth/context";
import { chaveMencao, listarAgentesApi } from "@/services/api/agentes";
import {
  AgentesContext,
  type AgenteMencionavel,
  type AgentesContextValue,
} from "./context";

// ----------------------------------------------------------------------
// Fonte única dos agentes mencionáveis (@) — do sistema e do usuário. Lido por
// todo lugar que lista, menciona ou identifica um agente: autocomplete do
// composer, respostas no chat, histórico e Configurações de usuário → Agentes.

/** Token "@Algo" precedido de início ou espaço (evita casar com e-mail). */
const MENCAO = /(^|\s)@([\p{L}\p{N}]+)/gu;

export function AgentesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const [sistema, setSistema] = useState<AgenteMencionavel[]>([]);
  const [meus, setMeus] = useState<AgenteMencionavel[]>([]);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await listarAgentesApi();
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
      setMeus(
        r.meus.map((a) => ({
          id: a.id,
          titulo: a.titulo,
          mencao: a.mencao,
          tipo: "pessoal" as const,
          icone: a.icone ?? null,
          descricao: a.descricao,
        })),
      );
    } catch {
      // Sem a lista, o Assistente segue funcionando sem agentes.
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // IIFE: o setState acontece depois do await, fora do corpo do efeito.
    void (async () => {
      await recarregar();
    })();
  }, [isAuthenticated, recarregar]);

  const todos = useMemo(() => [...sistema, ...meus], [sistema, meus]);

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
