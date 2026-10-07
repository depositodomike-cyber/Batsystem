// Host do assistente: guarda a conversa e faz as chamadas ao /ai/prompt. Fica
// acima do RouterProvider (em AccountScopedProviders), então a conversa
// sobrevive à navegação e à remontagem do painel.
//
// A UI (bolinha + painel) é montada separadamente por <AssistenteHost />, no
// layout Sideblock — é isso que restringe a bolinha às telas que também têm a
// barra de prompt no header.
//
// AGENTES são chamados por @menção, mensagem a mensagem — não existe "agente
// ativo" da conversa. No envio, as menções do texto viram uma chamada por
// agente, NA ORDEM em que aparecem, cada uma com o seu turno e o seu
// "pensando…". Sem menção, responde o Assistente padrão, como sempre. Um
// agente nunca recebe a resposta do outro à mesma pergunta: não há conversa
// entre agentes.
import { ReactNode, useCallback, useMemo, useRef, useState } from "react";

import {
  perguntarPromptApi,
  type HistoricoTurno,
  type MencaoAgente,
  type ModoBusca,
} from "@/services/api/prompt";
import {
  fetchConversaApi,
  marcarArquivoSalvoApi,
} from "@/services/api/conversas";
import { coletarReferencia } from "@/services/referencia";
import { marcarBuscaMemoria } from "@/utils/memoriaBusca";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { useAgentes } from "@/app/contexts/agentes/context";
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

/**
 * Histórico enviado à IA. Respostas de vários agentes à mesma pergunta viram
 * um par só, com cada resposta rotulada pelo agente — o modelo enxerga quem
 * disse o quê sem que a pergunta se repita.
 */
function historicoDe(turnos: Turno[]): HistoricoTurno[] {
  const pares: HistoricoTurno[] = [];
  for (const t of turnos) {
    if (t.pendente) continue;
    const resposta = t.agente ? `[${t.agente.titulo}] ${t.resposta}` : t.resposta;
    const ultimo = pares[pares.length - 1];
    if (t.continuacao && ultimo) {
      ultimo.resposta = `${ultimo.resposta}\n\n${resposta}`;
    } else {
      pares.push({ pergunta: t.pergunta, resposta });
    }
  }
  return pares;
}

// ----------------------------------------------------------------------

export function AssistenteHostProvider({ children }: { children: ReactNode }) {
  const { refresh } = useConversasContext();
  const { encontrarMencoes } = useAgentes();
  const repositorioId = useRepositorioAtivo()?.id ?? undefined;

  const [status, setStatus] = useState<AssistenteStatus>("closed");
  const [tab, setTab] = useState<AssistenteTab>("chat");
  const [conversa, setConversa] = useState<Turno[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [modoConversa, setModoConversa] = useState<ModoBusca>("vault");
  const [loading, setLoading] = useState(false);
  const [naoLido, setNaoLido] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);

  // `status` dentro dos callbacks assíncronos: sem isso, uma resposta que chega
  // depois de o usuário minimizar não acenderia o badge.
  const statusRef = useRef(status);
  statusRef.current = status;

  // Contexto da conversa atual (ex.: o insight de onde ela partiu). O backend
  // não o persiste, então ele é reenviado como `referencia` em cada turno.
  // Ref e não state: não aparece na tela e não deve causar re-render.
  const contextoRef = useRef<string | null>(null);
  const referenciaDoTurno = () =>
    [contextoRef.current, coletarReferencia()].filter(Boolean).join("\n\n") ||
    undefined;

  // Troca de repositório/organização: a conversa e o id pertencem ao contexto
  // anterior, então zeramos tudo e recolhemos o painel. Ajuste em render (e não
  // em efeito) para não exibir um frame com a conversa do repositório antigo.
  const repoRef = useRef(repositorioId);
  if (repoRef.current !== repositorioId) {
    repoRef.current = repositorioId;
    contextoRef.current = null;
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
    contextoRef.current = null;
    setConversa([]);
    setConversaId(null);
    setTab("chat");
    setStatus("open");
    setNaoLido(false);
  }, []);

  const inserirMencao = useCallback((agente: { mencao: string }) => {
    const token = `@${agente.mencao}`;
    setRascunho((r) => {
      // Já mencionado: não duplica, só devolve o foco.
      if (new RegExp(`(^|\\s)${token}(\\s|$)`, "u").test(r)) return r;
      const base = r.replace(/\s+$/, "");
      return `${base ? `${base} ` : ""}${token} `;
    });
    setTab("chat");
    setStatus("open");
    setNaoLido(false);
    setPedidoDeFoco((n) => n + 1);
  }, []);

  /** Marca não lido quando a resposta chega e o painel não está visível. */
  const sinalizarResposta = useCallback(() => {
    if (statusRef.current !== "open") setNaoLido(true);
  }, []);

  /**
   * Responde a uma pergunta — numa conversa nova (`base` vazia e sem id) ou
   * continuando a aberta. Com @menções, faz uma chamada por agente, em
   * sequência e na ordem das menções: a primeira grava a pergunta (e cria a
   * conversa, se preciso); as demais gravam só a própria resposta.
   */
  const responder = useCallback(
    async (p: {
      pergunta: string;
      modo: ModoBusca;
      base: Turno[];
      conversaIdBase: string | null;
      arquivo?: File | null;
    }): Promise<PerguntarResult> => {
      const { pergunta, modo, base } = p;
      const agentes = encontrarMencoes(pergunta);
      const mencoes: MencaoAgente[] = agentes.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        mencao: a.mencao,
      }));
      const origemPadrao = modo === "web" ? "web" : "vault";

      // Um turno pendente por agente (ou um só, do Assistente padrão).
      const pendentes: Turno[] = (agentes.length ? agentes : [null]).map(
        (a, i) => ({
          pergunta: i === 0 ? pergunta : "",
          resposta: "",
          fontes: [],
          origem: origemPadrao,
          pendente: true,
          agente: a ? { id: a.id, titulo: a.titulo } : null,
          mencoes: i === 0 && mencoes.length ? mencoes : undefined,
          continuacao: i > 0,
        }),
      );
      setConversa([...base, ...pendentes]);

      // Cada agente vê a conversa ATÉ esta pergunta — nunca a resposta do
      // outro agente a ela.
      const historico = historicoDe(base);
      const referencia = modo !== "web" ? referenciaDoTurno() : undefined;
      const animaGrafo = modo !== "web";
      if (animaGrafo) marcarBuscaMemoria(true);

      let cid = p.conversaIdBase;
      let resultado: PerguntarResult = { ok: false, erro: "" };
      try {
        for (let i = 0; i < pendentes.length; i++) {
          const pendente = pendentes[i];
          try {
            const r = await perguntarPromptApi({
              texto: pergunta,
              modo,
              arquivo: modo !== "web" ? p.arquivo : null,
              referencia,
              historico,
              conversaId: cid ?? undefined,
              repositorioId,
              agenteId: pendente.agente?.id,
              mencoes: i === 0 ? mencoes : undefined,
              // Sem conversa gravada (falhou a 1ª), cada um grava a sua.
              respostaAdicional: i > 0 && !!cid,
            });
            if (r.conversaId) {
              cid = r.conversaId;
              setConversaId(r.conversaId);
            }
            const pronto: Turno = {
              ...pendente,
              pendente: false,
              resposta: r.resposta,
              fontes: r.fontes,
              origem: r.origem,
              agente: r.agente ?? pendente.agente ?? null,
              arquivos: r.arquivos ?? [],
              mensagemId: r.mensagemId,
            };
            setConversa((c) => c.map((t) => (t === pendente ? pronto : t)));
            pendentes[i] = pronto;
            if (!resultado.ok) resultado = { ok: true, origem: r.origem };
          } catch (e) {
            const erro = msgErro(e, "Erro na busca.");
            const falha: Turno = {
              ...pendente,
              pendente: false,
              resposta: `⚠️ ${erro}`,
            };
            setConversa((c) => c.map((t) => (t === pendente ? falha : t)));
            pendentes[i] = falha;
            if (!resultado.ok) resultado = { ok: false, erro };
          }
        }
        sinalizarResposta();
        void refresh();
        // O título refinado pela IA chega um pouco depois da 1ª resposta.
        if (!p.conversaIdBase && cid) {
          window.setTimeout(() => void refresh(), 2500);
        }
        return resultado;
      } finally {
        if (animaGrafo) marcarBuscaMemoria(false);
      }
    },
    // `referenciaDoTurno` lê só refs e o storage local.
    [encontrarMencoes, refresh, repositorioId, sinalizarResposta],
  );

  const perguntar = useCallback(
    async ({
      texto,
      modo,
      arquivo,
      contexto,
    }: {
      texto: string;
      modo: ModoBusca;
      arquivo?: File | null;
      contexto?: string;
    }): Promise<PerguntarResult> => {
      const pergunta = texto.trim();
      if (!pergunta || loading) return { ok: false, erro: "" };
      // Conversa nova: o contexto é o desta pergunta (ou nenhum).
      contextoRef.current = contexto?.trim() || null;

      setLoading(true);
      setModoConversa(modo);
      setTab("chat");
      setConversaId(null);
      setStatus("open");
      setNaoLido(false);
      try {
        return await responder({
          pergunta,
          modo,
          base: [],
          conversaIdBase: null,
          arquivo,
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, responder],
  );

  const continuar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || loading) return;
      setLoading(true);
      try {
        await responder({
          pergunta,
          modo: modoConversa,
          base: conversa,
          conversaIdBase: conversaId,
        });
      } finally {
        setLoading(false);
      }
    },
    [conversa, conversaId, loading, modoConversa, responder],
  );

  const marcarArquivoSalvo = useCallback(
    async (p: {
      mensagemId: string;
      arquivoId: string;
      repositorioDocumentoId: string;
    }) => {
      if (!conversaId) return;
      await marcarArquivoSalvoApi({ conversaId, ...p });
      setConversa((c) =>
        c.map((t) =>
          t.mensagemId === p.mensagemId
            ? {
                ...t,
                arquivos: (t.arquivos ?? []).map((a) =>
                  a.id === p.arquivoId
                    ? { ...a, repositorioDocumentoId: p.repositorioDocumentoId }
                    : a,
                ),
              }
            : t,
        ),
      );
    },
    [conversaId],
  );

  const anunciar = useCallback(
    ({ titulo, corpo }: { titulo: string; corpo: string }) => {
      setTab("chat");
      // `origem: "vault"` porque o aviso nasce dentro do produto, não da web —
      // e sem `fontes`, que só existem para resposta de busca.
      setConversa((c) => [
        ...c,
        { pergunta: titulo, resposta: corpo, fontes: [], origem: "vault" },
      ]);
      setStatus("open");
      setNaoLido(false);
    },
    [],
  );

  const abrirConversa = useCallback(
    async (id: string) => {
      if (loading) return;
      // Conversa do histórico: o contexto de origem não foi persistido.
      contextoRef.current = null;
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
      rascunho,
      setRascunho,
      pedidoDeFoco,
      inserirMencao,
      marcarArquivoSalvo,
      setTab,
      setExpandido,
      open,
      minimize,
      close,
      novaConversa,
      perguntar,
      continuar,
      anunciar,
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
      rascunho,
      pedidoDeFoco,
      inserirMencao,
      marcarArquivoSalvo,
      open,
      minimize,
      close,
      novaConversa,
      perguntar,
      continuar,
      anunciar,
      abrirConversa,
    ],
  );

  return <Ctx value={value}>{children}</Ctx>;
}
