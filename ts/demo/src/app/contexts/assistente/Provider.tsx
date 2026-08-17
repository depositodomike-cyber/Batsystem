// Host do assistente: guarda a conversa e faz as chamadas ao /ai/prompt. Fica
// acima do RouterProvider (em AccountScopedProviders), então a conversa
// sobrevive à navegação e à remontagem do painel.
//
// A UI (bolinha + painel) é montada separadamente por <AssistenteHost />, no
// layout Sideblock — é isso que restringe a bolinha às telas que também têm a
// barra de prompt no header.
import { ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { perguntarPromptApi, type ModoBusca } from "@/services/api/prompt";
import { fetchConversaApi } from "@/services/api/conversas";
import { coletarReferencia } from "@/services/referencia";
import { marcarBuscaMemoria } from "@/utils/memoriaBusca";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import {
  AssistenteProvider as Ctx,
  type AssistenteContextValue,
  type AssistenteStatus,
  type AssistenteTab,
  type PerguntarResult,
  type Turno,
} from "./context";
import { turnosDeMensagens } from "./turnos";

// ----------------------------------------------------------------------

function msgErro(e: unknown, fallback: string): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (Array.isArray(m) && m.length) return String(m[0]);
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

// ----------------------------------------------------------------------

export function AssistenteHostProvider({ children }: { children: ReactNode }) {
  const { refresh } = useConversasContext();
  const repositorioId = useRepositorioAtivo()?.id ?? undefined;

  const [status, setStatus] = useState<AssistenteStatus>("closed");
  const [tab, setTab] = useState<AssistenteTab>("chat");
  const [conversa, setConversa] = useState<Turno[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [modoConversa, setModoConversa] = useState<ModoBusca>("vault");
  const [loading, setLoading] = useState(false);
  const [naoLido, setNaoLido] = useState(false);
  const [expandido, setExpandido] = useState(false);

  // `status` dentro dos callbacks assíncronos: sem isso, uma resposta que chega
  // depois de o usuário minimizar não acenderia o badge.
  const statusRef = useRef(status);
  statusRef.current = status;

  // Troca de repositório/organização: a conversa e o id pertencem ao contexto
  // anterior, então zeramos tudo e recolhemos o painel. Ajuste em render (e não
  // em efeito) para não exibir um frame com a conversa do repositório antigo.
  const repoRef = useRef(repositorioId);
  if (repoRef.current !== repositorioId) {
    repoRef.current = repositorioId;
    setConversa([]);
    setConversaId(null);
    setStatus("closed");
    setTab("chat");
    setNaoLido(false);
    setExpandido(false);
  }

  const open = useCallback(() => {
    setStatus("open");
    setNaoLido(false);
  }, []);

  const minimize = useCallback(() => setStatus("minimized"), []);

  // Fechar reseta o tamanho: a próxima abertura começa ancorada no canto.
  // Minimizar, não — restaurar devolve o painel do tamanho em que estava.
  const close = useCallback(() => {
    setStatus("closed");
    setExpandido(false);
  }, []);

  const novaConversa = useCallback(() => {
    setConversa([]);
    setConversaId(null);
    setTab("chat");
    setStatus("open");
    setNaoLido(false);
  }, []);

  /** Marca não lido quando a resposta chega e o painel não está visível. */
  const sinalizarResposta = useCallback(() => {
    if (statusRef.current !== "open") setNaoLido(true);
  }, []);

  const perguntar = useCallback(
    async ({
      texto,
      modo,
      arquivo,
    }: {
      texto: string;
      modo: ModoBusca;
      arquivo?: File | null;
    }): Promise<PerguntarResult> => {
      const pergunta = texto.trim();
      if (!pergunta || loading) return { ok: false, erro: "" };

      setLoading(true);
      setModoConversa(modo);
      setTab("chat");
      // Turno pendente já visível: a bolinha abre mostrando "pensando…".
      setConversa([
        {
          pergunta,
          resposta: "",
          fontes: [],
          origem: modo === "web" ? "web" : "vault",
          pendente: true,
        },
      ]);
      setConversaId(null);
      setStatus("open");
      setNaoLido(false);

      // Busca que toca o Repositório faz o grafo "pensar" enquanto a resposta
      // não vem. No modo Web o anexo/contexto local é ignorado.
      const animaGrafo = modo !== "web";
      if (animaGrafo) marcarBuscaMemoria(true);
      try {
        const referencia = modo !== "web" ? coletarReferencia() : undefined;
        const r = await perguntarPromptApi({
          texto: pergunta,
          modo,
          arquivo: modo !== "web" ? arquivo : null,
          referencia,
          repositorioId,
        });
        setConversaId(r.conversaId ?? null);
        setConversa([
          {
            pergunta,
            resposta: r.resposta,
            fontes: r.fontes,
            origem: r.origem,
          },
        ]);
        sinalizarResposta();
        void refresh();
        if (r.conversaId) {
          window.setTimeout(() => void refresh(), 2500);
        }
        return { ok: true, origem: r.origem };
      } catch (e) {
        const erro = msgErro(e, "Erro na busca.");
        setConversa([
          {
            pergunta,
            resposta: `⚠️ ${erro}`,
            fontes: [],
            origem: modo === "web" ? "web" : "vault",
          },
        ]);
        sinalizarResposta();
        return { ok: false, erro };
      } finally {
        if (animaGrafo) marcarBuscaMemoria(false);
        setLoading(false);
      }
    },
    [loading, refresh, repositorioId, sinalizarResposta],
  );

  const continuar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || loading) return;

      const base = conversa;
      const historico = base.map((t) => ({
        pergunta: t.pergunta,
        resposta: t.resposta,
      }));
      const pendente: Turno = {
        pergunta,
        resposta: "",
        fontes: [],
        origem: base[0]?.origem ?? "vault",
        pendente: true,
      };
      setConversa([...base, pendente]);
      setLoading(true);

      const animaGrafo = modoConversa !== "web";
      if (animaGrafo) marcarBuscaMemoria(true);
      try {
        const referencia =
          modoConversa !== "web" ? coletarReferencia() : undefined;
        const r = await perguntarPromptApi({
          texto: pergunta,
          modo: modoConversa,
          historico,
          conversaId: conversaId ?? undefined,
          referencia,
          repositorioId,
        });
        if (r.conversaId) setConversaId(r.conversaId);
        void refresh();
        setConversa((c) =>
          c.map((t) =>
            t === pendente
              ? {
                  pergunta,
                  resposta: r.resposta,
                  fontes: r.fontes,
                  origem: r.origem,
                }
              : t,
          ),
        );
        sinalizarResposta();
      } catch (e) {
        const msg = "⚠️ " + msgErro(e, "Erro na busca.");
        setConversa((c) =>
          c.map((t) =>
            t === pendente ? { ...t, resposta: msg, pendente: false } : t,
          ),
        );
        sinalizarResposta();
      } finally {
        if (animaGrafo) marcarBuscaMemoria(false);
        setLoading(false);
      }
    },
    [
      conversa,
      conversaId,
      loading,
      modoConversa,
      refresh,
      repositorioId,
      sinalizarResposta,
    ],
  );

  const abrirConversa = useCallback(
    async (id: string) => {
      if (loading) return;
      setLoading(true);
      setTab("chat");
      setStatus("open");
      setNaoLido(false);
      try {
        const c = await fetchConversaApi(id, { repositorioId });
        setConversaId(c.id);
        setModoConversa(
          c.modo === "web" || c.modo === "auto" || c.modo === "vault"
            ? c.modo
            : "vault",
        );
        setConversa(turnosDeMensagens(c.messages));
      } catch (e) {
        setConversa([
          {
            pergunta: "",
            resposta: `⚠️ ${msgErro(e, "Não foi possível abrir a conversa.")}`,
            fontes: [],
            origem: "vault",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, repositorioId],
  );

  const value = useMemo<AssistenteContextValue>(
    () => ({
      status,
      tab,
      conversa,
      conversaId,
      modoConversa,
      loading,
      naoLido,
      expandido,
      setTab,
      setExpandido,
      open,
      minimize,
      close,
      novaConversa,
      perguntar,
      continuar,
      abrirConversa,
    }),
    [
      status,
      tab,
      conversa,
      conversaId,
      modoConversa,
      loading,
      naoLido,
      expandido,
      open,
      minimize,
      close,
      novaConversa,
      perguntar,
      continuar,
      abrirConversa,
    ],
  );

  return <Ctx value={value}>{children}</Ctx>;
}
