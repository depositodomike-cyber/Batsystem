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
//
// SEM menção (e sem anexo), a pergunta vai ao ORQUESTRADOR, que decide entre
// responder direto ou resolver em etapas (memória, web, especialistas),
// mostrando as etapas no turno enquanto acontecem. Com a rota desligada no
// servidor, tudo segue pelo /ai/prompt como antes.
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  cancelarExecucaoApi,
  decidirAprovacaoApi,
  etapasParaTela,
  listarAbertasApi,
  orquestradorDisponivel,
  orquestrarApi,
  OrquestradorIndisponivel,
  retomarExecucaoApi,
  type DesfechoOrquestrador,
  type EtapaOrquestrador,
  type ExecucaoAberta,
  type OrquestrarCallbacks,
} from "@/services/api/orquestrador";
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
  type ExecucaoDoTurno,
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

/** A execução do turno (ou uma vazia, para começar a preencher). */
function comExecucao(t: Turno): ExecucaoDoTurno {
  return t.execucao ?? { etapas: [] };
}

/** Acrescenta a etapa, ou atualiza a de mesma chave. */
function comEtapa(ex: ExecucaoDoTurno, etapa: EtapaOrquestrador): ExecucaoDoTurno {
  const existe = ex.etapas.some((e) => e.chave === etapa.chave);
  return {
    ...ex,
    etapas: existe
      ? ex.etapas.map((e) => (e.chave === etapa.chave ? etapa : e))
      : [...ex.etapas, etapa],
  };
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
  // Padrão "auto": a IA decide se responde pela memória ou pesquisando na web.
  const [modoConversa, setModoConversa] = useState<ModoBusca>("auto");
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
   * Um turno pelo orquestrador. As etapas atualizam o turno pendente ao vivo.
   * Devolve `null` quando a rota não está disponível (flag desligada no
   * servidor ou sem permissão) — aí quem chamou segue pelo /ai/prompt.
   */
  const responderOrquestrado = useCallback(
    async (p: {
      pendente: Turno;
      pergunta: string;
      modo: ModoBusca;
      historico: HistoricoTurno[];
      referencia?: string;
      conversaId: string | null;
    }): Promise<{ resultado: PerguntarResult; conversaId?: string } | null> => {
      // O turno é trocado por cópias a cada evento; `atual` é a versão que
      // está na tela, para o próximo `map` achá-la pela identidade.
      let atual = p.pendente;
      const trocar = (novo: Turno) => {
        const antes = atual;
        atual = novo;
        setConversa((c) => c.map((t) => (t === antes ? novo : t)));
      };
      try {
        const r = await orquestrarApi(
          {
            texto: p.pergunta,
            modo: p.modo,
            historico: p.historico,
            referencia: p.referencia,
            conversaId: p.conversaId ?? undefined,
            repositorioId,
          },
          {
            onRota: (rota) => {
              if (rota === "plano") trocar({ ...atual, execucao: { etapas: [] } });
            },
            onExecucao: (id) =>
              trocar({ ...atual, execucao: { ...comExecucao(atual), id } }),
            onEtapa: (etapa) =>
              trocar({ ...atual, execucao: comEtapa(comExecucao(atual), etapa) }),
          },
        );
        if (r.tipo === "pausa") {
          // Parou numa escrita: o turno mostra o pedido de aprovação, e a
          // resposta só vem depois da decisão (ver `decidirAprovacao`).
          trocar({
            ...atual,
            pendente: false,
            resposta: "",
            execucao: { ...comExecucao(atual), id: r.execucaoId, aprovacoes: r.aprovacoes },
          });
          return { resultado: { ok: true, origem: "vault" } };
        }
        if (r.conversaId) setConversaId(r.conversaId);
        trocar({
          ...atual,
          pendente: false,
          resposta: r.resposta,
          fontes: r.fontes,
          origem: r.origem,
          mensagemId: r.mensagemId,
          ...(r.execucaoId
            ? { execucao: { etapas: atual.execucao?.etapas ?? [], id: r.execucaoId } }
            : {}),
        });
        return {
          resultado: { ok: true, origem: r.origem, resposta: r.resposta },
          conversaId: r.conversaId,
        };
      } catch (e) {
        if (e instanceof OrquestradorIndisponivel) return null;
        const erro = msgErro(e, "Erro na busca.");
        trocar({ ...atual, pendente: false, resposta: `⚠️ ${erro}` });
        return { resultado: { ok: false, erro } };
      }
    },
    [repositorioId],
  );

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
        // Sem @menção e sem anexo, o orquestrador decide: responde direto
        // (igual ao /ai/prompt) ou resolve em etapas. Se a rota não estiver
        // disponível no servidor, cai no /ai/prompt logo abaixo.
        const orquestrado =
          agentes.length === 0 && !(p.arquivo && modo !== "web") && orquestradorDisponivel()
            ? await responderOrquestrado({
                pendente: pendentes[0],
                pergunta,
                modo,
                historico,
                referencia,
                conversaId: cid,
              })
            : null;
        if (orquestrado) {
          resultado = orquestrado.resultado;
          cid = orquestrado.conversaId ?? cid;
        }
        for (let i = 0; !orquestrado && i < pendentes.length; i++) {
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
            if (!resultado.ok) resultado = { ok: true, origem: r.origem, resposta: r.resposta };
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
    [encontrarMencoes, refresh, repositorioId, responderOrquestrado, sinalizarResposta],
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
            : "auto",
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

  // ---------------------------------------------------- Execuções em aberto
  // Execuções que pararam esperando o usuário (aprovação) ou que a API
  // interrompeu: listadas no painel para decidir, retomar ou descartar.
  const [abertas, setAbertas] = useState<ExecucaoAberta[]>([]);
  const carregarAbertas = useCallback(async () => {
    setAbertas(await listarAbertasApi());
  }, []);

  // Ao abrir o painel: o usuário pode ter saído no meio de uma execução.
  useEffect(() => {
    if (status === "open") void carregarAbertas();
  }, [status, carregarAbertas]);

  /** Aplica `f` ao turno desta execução (achado pelo id, não pela posição). */
  const noTurnoDa = useCallback(
    (execucaoId: string, f: (t: Turno) => Turno) =>
      setConversa((c) => c.map((t) => (t.execucao?.id === execucaoId ? f(t) : t))),
    [],
  );

  /**
   * Acompanha a continuação de uma execução (decisão ou retomada) no turno
   * dela: etapas ao vivo e, no fim, a resposta, uma nova pausa ou "ainda
   * aguardando" (outras aprovações da mesma execução).
   */
  const seguirExecucao = useCallback(
    async (
      execucaoId: string,
      iniciar: (cb: OrquestrarCallbacks) => Promise<DesfechoOrquestrador>,
      aoAguardar?: (t: Turno) => Turno,
    ) => {
      const noTurno = (f: (t: Turno) => Turno) => noTurnoDa(execucaoId, f);
      setLoading(true);
      try {
        const r = await iniciar({
          onEtapa: (etapa) => noTurno((t) => ({ ...t, execucao: comEtapa(comExecucao(t), etapa) })),
        });
        if (r.tipo === "aguardando") {
          noTurno((t) => ({ ...(aoAguardar ? aoAguardar(t) : t), pendente: false }));
          return;
        }
        if (r.tipo === "pausa") {
          noTurno((t) => ({
            ...t,
            pendente: false,
            execucao: { ...comExecucao(t), aprovacoes: r.aprovacoes },
          }));
          return;
        }
        if (r.conversaId) setConversaId((atual) => atual ?? r.conversaId ?? null);
        noTurno((t) => ({
          ...t,
          pendente: false,
          resposta: r.resposta,
          fontes: r.fontes,
          origem: r.origem,
          mensagemId: r.mensagemId,
          execucao: { ...comExecucao(t), aprovacoes: [] },
        }));
        sinalizarResposta();
        void refresh();
      } catch (e) {
        noTurno((t) => ({
          ...t,
          pendente: false,
          resposta: `⚠️ ${msgErro(e, "Não foi possível continuar a tarefa.")}`,
          execucao: { ...comExecucao(t), aprovacoes: [] },
        }));
      } finally {
        setLoading(false);
        void carregarAbertas();
      }
    },
    [carregarAbertas, noTurnoDa, refresh, sinalizarResposta],
  );

  const decidirAprovacao = useCallback(
    async ({
      execucaoId,
      aprovacaoId,
      aprovar,
    }: {
      execucaoId: string;
      aprovacaoId: string;
      aprovar: boolean;
    }) => {
      noTurnoDa(execucaoId, (t) => ({
        ...t,
        pendente: true,
        execucao: {
          ...comExecucao(t),
          aprovacoes: (t.execucao?.aprovacoes ?? []).map((a) =>
            a.id === aprovacaoId ? { ...a, enviando: true } : a,
          ),
        },
      }));
      await seguirExecucao(
        execucaoId,
        (cb) => decidirAprovacaoApi(aprovacaoId, { aprovar }, cb),
        // Outras ações da mesma execução ainda esperam: só esta sai da tela.
        (t) => ({
          ...t,
          execucao: {
            ...comExecucao(t),
            aprovacoes: (t.execucao?.aprovacoes ?? []).filter((a) => a.id !== aprovacaoId),
          },
        }),
      );
    },
    [noTurnoDa, seguirExecucao],
  );

  /**
   * Mostra uma execução em aberto num painel limpo (como uma conversa nova):
   * a pergunta, as etapas até aqui e as aprovações pendentes. Interrompida e
   * retomável, já continua de onde parou.
   */
  const abrirExecucao = useCallback(
    async (e: ExecucaoAberta) => {
      if (loading) return;
      contextoRef.current = null;
      const rodando = e.status === "executando" || e.status === "planejando";
      setConversaId(null);
      setTab("chat");
      setStatus("open");
      setNaoLido(false);
      setConversa([
        {
          pergunta: e.pedido,
          resposta: rodando ? "Esta tarefa ainda está em andamento; a resposta vai para o Histórico quando terminar." : "",
          fontes: [],
          origem: "vault",
          pendente: e.status === "interrompida" && e.retomavel,
          execucao: { id: e.id, etapas: etapasParaTela(e.etapas), aprovacoes: e.aprovacoes },
        },
      ]);
      if (e.status === "interrompida" && e.retomavel) {
        await seguirExecucao(e.id, (cb) => retomarExecucaoApi(e.id, cb));
      }
    },
    [loading, seguirExecucao],
  );

  const descartarExecucao = useCallback(
    async (execucaoId: string) => {
      try {
        await cancelarExecucaoApi(execucaoId);
        noTurnoDa(execucaoId, (t) => ({
          ...t,
          pendente: false,
          resposta: "Tarefa descartada. Nada pendente foi executado.",
          execucao: { ...comExecucao(t), aprovacoes: [] },
        }));
      } finally {
        void carregarAbertas();
      }
    },
    [carregarAbertas, noTurnoDa],
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
      decidirAprovacao,
      abertas,
      abrirExecucao,
      descartarExecucao,
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
      decidirAprovacao,
      abertas,
      abrirExecucao,
      descartarExecucao,
    ],
  );

  return <Ctx value={value}>{children}</Ctx>;
}
