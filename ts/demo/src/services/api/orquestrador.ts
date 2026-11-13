// Orquestrador do Assistente (backend: POST /ai/orquestrar, SSE).
//
// O backend decide se o pedido é simples (responde como o /ai/prompt) ou se
// vira uma execução em etapas — memória, web e especialistas. Aqui só lemos os
// eventos e os repassamos ao chamador.
//
// Ações de ESCRITA (ex.: salvar no Repositório) pausam a execução: chega um
// evento `aprovacao` e o stream termina sem resposta. A decisão do usuário vai
// para POST /ai/aprovacoes/:id/decisao, que responde no mesmo formato e
// continua a execução de onde parou.
//
// A rota fica atrás de uma flag no backend (ORQUESTRADOR_ATIVO). Desligada ela
// responde 404; sem a permissão `ia.usar`, 403. Nos dois casos lançamos
// `OrquestradorIndisponivel` ANTES de qualquer evento, e o chamador cai no
// /ai/prompt de sempre. O 404 é lembrado até recarregar a página para não
// repetir a tentativa a cada pergunta.
import axios, { HEADER_ORGANIZACAO, HEADER_REPOSITORIO } from "@/utils/axios";
import { JWT_HOST_API } from "@/configs/auth";
import { tokenArmazenado } from "@/utils/sessaoLocal";
import { repositorioPastaAtivo } from "@/app/pages/ceo/memoria-inventario";
import { organizacaoAtivaId } from "@/app/pages/ceo/repositorio-org/escopo";
import { AGENTES_SISTEMA_VISIVEIS } from "@/app/data/agentesVisiveis";
import type { Fonte, HistoricoTurno, ModoBusca } from "./prompt";

export type StatusEtapa =
  | "executando"
  | "concluida"
  | "falhou"
  | "aguardando_aprovacao"
  | "negada";

export interface EtapaOrquestrador {
  chave: string;
  ferramenta: string;
  descricao: string;
  status: StatusEtapa;
  erro?: string;
}

export interface PlanoOrquestrador {
  objetivo: string;
  etapas: { chave: string; descricao: string; ferramenta: string | null; dependeDe: string[] }[];
}

/** Uma ação de escrita esperando o usuário. */
export interface AprovacaoOrquestrador {
  id: string;
  chave: string;
  ferramenta: string;
  /** Frase pronta: o que vai acontecer se aprovar. */
  resumo: string;
  /** Parâmetros exatos que serão executados. */
  entrada: Record<string, unknown>;
  expiraEm: string;
  /** Parecer do revisor de segurança (consultivo: alerta, não autoriza). */
  revisao?: ParecerRevisao;
}

export interface ParecerRevisao {
  nivel: "baixo" | "medio" | "alto" | "desconhecido";
  recomendacao: "seguir" | "atencao" | "bloquear";
  motivos: string[];
  /** O revisor não respondeu. */
  falhou?: boolean;
}

export interface RespostaOrquestrador {
  tipo: "resposta";
  resposta: string;
  fontes: Fonte[];
  origem: "vault" | "web";
  conversaId?: string;
  mensagemId?: string;
  /** Presente quando o pedido virou uma execução em etapas. */
  execucaoId?: string;
}

/** A execução parou esperando aprovação. */
export interface PausaOrquestrador {
  tipo: "pausa";
  execucaoId: string;
  aprovacoes: AprovacaoOrquestrador[];
}

/** Decisão registrada, mas outras aprovações da execução seguem pendentes. */
export interface AguardandoOrquestrador {
  tipo: "aguardando";
  execucaoId: string;
  pendentes: number;
}

export type DesfechoOrquestrador = RespostaOrquestrador | PausaOrquestrador | AguardandoOrquestrador;

export interface OrquestrarParams {
  texto: string;
  modo: ModoBusca;
  historico?: HistoricoTurno[];
  referencia?: string;
  conversaId?: string;
  repositorioId?: string;
  /**
   * Como o pedido chegou. "voz_ativacao" (palavra "Oracle") faz o servidor
   * pedir confirmação até para ações moderadas no computador (SR-06b).
   */
  origem?: OrigemPedido;
  /** Outras transcrições do ditado: o servidor corrige nomes de apps com elas. */
  alternativas?: string[];
}

export type OrigemPedido = "texto" | "voz" | "voz_ativacao";

export interface OrquestrarCallbacks {
  onRota?: (rota: "direta" | "plano") => void;
  onExecucao?: (execucaoId: string) => void;
  onPlano?: (plano: PlanoOrquestrador) => void;
  onEtapa?: (etapa: EtapaOrquestrador) => void;
}

/** A rota não está disponível: use o /ai/prompt. */
export class OrquestradorIndisponivel extends Error {}

let desligadoNoServidor = false;

/** false depois que o servidor disse que a rota não existe (flag desligada). */
export function orquestradorDisponivel(): boolean {
  return !desligadoNoServidor;
}

function headers(): Record<string, string> {
  const token = tokenArmazenado();
  const repositorioPasta = repositorioPastaAtivo();
  const organizacaoId = organizacaoAtivaId();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // Os mesmos headers que o interceptor do axios injeta.
    ...(repositorioPasta ? { [HEADER_REPOSITORIO]: repositorioPasta } : {}),
    ...(organizacaoId ? { [HEADER_ORGANIZACAO]: organizacaoId } : {}),
  };
}

async function erroDaResposta(res: Response): Promise<Error> {
  let mensagem = "Não foi possível conectar à IA.";
  try {
    const corpo = (await res.json()) as { message?: string | string[] };
    const m = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message;
    if (m) mensagem = m;
  } catch {
    // corpo não-JSON: fica a mensagem genérica
  }
  return new Error(mensagem);
}

/** Lê o SSE até o fim e devolve como a execução terminou (ou pausou). */
async function lerEventos(res: Response, cb: OrquestrarCallbacks): Promise<DesfechoOrquestrador> {
  if (!res.body) throw new Error("Não foi possível conectar à IA.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let desfecho: DesfechoOrquestrador | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const partes = buffer.split("\n\n");
    buffer = partes.pop() ?? "";
    for (const parte of partes) {
      const linha = parte.split("\n").find((l) => l.startsWith("data:"));
      const json = linha?.slice(5).trim();
      if (!json) continue;
      let evt: { type: string } & Record<string, unknown>;
      try {
        evt = JSON.parse(json);
      } catch {
        continue;
      }
      switch (evt.type) {
        case "rota":
          cb.onRota?.(evt.rota as "direta" | "plano");
          break;
        case "execucao":
          cb.onExecucao?.(evt.execucaoId as string);
          break;
        case "plano":
          cb.onPlano?.(evt.plano as PlanoOrquestrador);
          break;
        case "etapa":
          cb.onEtapa?.(evt.etapa as EtapaOrquestrador);
          break;
        case "resposta":
          desfecho = { ...(evt as unknown as Omit<RespostaOrquestrador, "tipo">), tipo: "resposta" };
          break;
        case "aprovacao":
          desfecho = {
            tipo: "pausa",
            execucaoId: evt.execucaoId as string,
            aprovacoes: evt.aprovacoes as AprovacaoOrquestrador[],
          };
          break;
        case "aguardando":
          desfecho = {
            tipo: "aguardando",
            execucaoId: evt.execucaoId as string,
            pendentes: evt.pendentes as number,
          };
          break;
        case "error":
          throw new Error((evt.message as string) || "Erro ao gerar resposta.");
      }
    }
  }

  if (!desfecho) throw new Error("A resposta não chegou. Tente novamente.");
  return desfecho;
}

export async function orquestrarApi(
  p: OrquestrarParams,
  cb: OrquestrarCallbacks = {},
): Promise<RespostaOrquestrador | PausaOrquestrador> {
  if (desligadoNoServidor) throw new OrquestradorIndisponivel();

  const res = await fetch(`${JWT_HOST_API}/ai/orquestrar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      texto: p.texto,
      modo: p.modo,
      ...(p.historico?.length ? { historico: p.historico } : {}),
      ...(p.referencia ? { referencia: p.referencia } : {}),
      ...(p.conversaId ? { conversaId: p.conversaId } : {}),
      ...(p.repositorioId ? { repositorioId: p.repositorioId } : {}),
      ...(p.origem ? { origem: p.origem } : {}),
      ...(p.alternativas?.length ? { alternativas: p.alternativas.slice(0, 5) } : {}),
      // O orquestrador só oferece os agentes do sistema que a interface
      // exibe — sem isto ele consultaria especialistas ocultos.
      ...(AGENTES_SISTEMA_VISIVEIS ? { agentesSistema: AGENTES_SISTEMA_VISIVEIS } : {}),
    }),
  });

  if (res.status === 404) {
    desligadoNoServidor = true;
    throw new OrquestradorIndisponivel();
  }
  if (res.status === 403) throw new OrquestradorIndisponivel();
  if (!res.ok) throw await erroDaResposta(res);

  const d = await lerEventos(res, cb);
  // "aguardando" só vem de uma decisão, nunca de um pedido novo.
  if (d.tipo === "aguardando") throw new Error("Resposta inesperada do servidor.");
  return d;
}

/**
 * Aprova ou nega uma ação. Se era a última pendente, a execução continua e
 * os eventos chegam pelos mesmos callbacks; o desfecho pode ser a resposta,
 * uma nova pausa ou "aguardando" (ainda há outras aprovações).
 */
export async function decidirAprovacaoApi(
  aprovacaoId: string,
  p: { aprovar: boolean; motivo?: string },
  cb: OrquestrarCallbacks = {},
): Promise<DesfechoOrquestrador> {
  const res = await fetch(
    `${JWT_HOST_API}/ai/aprovacoes/${encodeURIComponent(aprovacaoId)}/decisao`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ aprovar: p.aprovar, ...(p.motivo ? { motivo: p.motivo } : {}) }),
    },
  );
  if (!res.ok) throw await erroDaResposta(res);
  return lerEventos(res, cb);
}

/** Continua uma execução interrompida (a API caiu no meio) do último ponto salvo. */
export async function retomarExecucaoApi(
  execucaoId: string,
  cb: OrquestrarCallbacks = {},
): Promise<DesfechoOrquestrador> {
  const res = await fetch(
    `${JWT_HOST_API}/ai/execucoes/${encodeURIComponent(execucaoId)}/retomar`,
    { method: "POST", headers: headers() },
  );
  if (!res.ok) throw await erroDaResposta(res);
  return lerEventos(res, cb);
}

/** Descarta uma execução parada; aprovações pendentes viram negadas. */
export async function cancelarExecucaoApi(execucaoId: string): Promise<void> {
  await axios.post(`/ai/execucoes/${encodeURIComponent(execucaoId)}/cancelar`);
}

/** Execução que ainda pede algo do usuário (GET /ai/execucoes/abertas). */
export interface ExecucaoAberta {
  id: string;
  pedido: string;
  status: "aguardando_aprovacao" | "interrompida" | "executando" | "planejando";
  criadoEm: string;
  /** Interrompida com estado salvo: dá para continuar de onde parou. */
  retomavel: boolean;
  etapas: EtapaGravada[];
  aprovacoes: AprovacaoOrquestrador[];
}

/**
 * Execuções em aberto do usuário. Com a rota desligada no servidor (404),
 * devolve lista vazia e lembra, como o `orquestrarApi`.
 */
export async function listarAbertasApi(): Promise<ExecucaoAberta[]> {
  if (desligadoNoServidor) return [];
  try {
    const { data } = await axios.get<ExecucaoAberta[]>("/ai/execucoes/abertas");
    return data;
  } catch (e) {
    // O interceptor do axios rejeita com o corpo do Nest: { statusCode, message }.
    if ((e as { statusCode?: number } | null)?.statusCode === 404) desligadoNoServidor = true;
    return [];
  }
}

/** Etapa gravada de uma execução (GET /ai/execucoes/:id). */
export interface EtapaGravada {
  chave: string;
  ferramenta: string | null;
  descricao: string;
  status: "pendente" | "executando" | "aguardando_aprovacao" | "concluida" | "falhou" | "pulada" | "negada";
  erro: string | null;
}

export interface ExecucaoGravada {
  id: string;
  status: string;
  plano: PlanoOrquestrador | null;
  etapas: EtapaGravada[];
}

/** Etapa gravada → a forma que a lista do painel desenha (só chamadas de ferramenta). */
export function etapasParaTela(etapas: EtapaGravada[]): EtapaOrquestrador[] {
  return etapas
    .filter((e) => e.ferramenta)
    .map((e) => ({
      chave: e.chave,
      ferramenta: e.ferramenta ?? "",
      descricao: e.descricao,
      status:
        e.status === "concluida" || e.status === "aguardando_aprovacao" || e.status === "negada"
          ? e.status
          : e.status === "executando" || e.status === "pendente"
            ? "executando"
            : "falhou",
      erro: e.erro ?? undefined,
    }));
}

export async function fetchExecucaoApi(id: string): Promise<ExecucaoGravada> {
  const { data } = await axios.get<ExecucaoGravada>(`/ai/execucoes/${encodeURIComponent(id)}`);
  return data;
}
