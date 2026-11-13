import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PromptService, type Fonte } from '@/ai/prompt.service';
import type { HistoricoTurno, ModoBusca } from '@/ai/prompt/framework';
import type { LlmUsage } from '@/ai/providers';
import type { MensagemComFerramentas } from '@/ai/tool-use';
import { ConversasService } from '@/conversas/conversas.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { RoteadorService, type Rota } from './roteador.service';
import { PlanejadorService, planoEmTexto, type Plano } from './planejador.service';
import {
  estadoInicial,
  ExecutorService,
  LIMITES_DESKTOP,
  LIMITES_PADRAO,
  type AoCheckpoint,
  type DecisaoGravada,
  type EstadoExecutor,
  type EtapaEvento,
  type ResultadoExecutor,
} from './executor.service';
import { AuditoriaService } from './auditoria.service';
import { RevisorSegurancaService, type Parecer } from './revisor.service';
import { RegistroFerramentasService } from './ferramentas/registro.service';
import { ComandosDesktopService, type DecisaoComando } from '@/desktop/comandos.service';

export interface PedidoOrquestrador {
  user: AuthenticatedUser;
  texto: string;
  modo?: ModoBusca;
  historico: HistoricoTurno[];
  referencia?: string;
  conversaId?: string;
  repositorioId: string | null;
  organizacaoId: string | null;
  /** Agentes do sistema exibidos na interface (ausente = todos). */
  agentesSistema?: string[] | null;
  /** Como o pedido chegou (texto, ditado ou palavra de ativação). */
  origem?: 'texto' | 'voz' | 'voz_ativacao';
  /** Outras transcrições do ditado, para corrigir nomes de apps. */
  alternativas?: string[];
}

/** Comando de computador pronto para o caminho rápido. */
interface ComandoDireto {
  entendido: string;
  chamada: { nome: string; entrada: Record<string, unknown> };
}

/** Uma escrita esperando o usuário, como o cliente a recebe. */
export interface AprovacaoParaCliente {
  id: string;
  chave: string;
  ferramenta: string;
  resumo: string;
  entrada: Record<string, unknown>;
  expiraEm: string;
  /** Parecer do revisor de segurança (consultivo). */
  revisao: Parecer;
}

/** Eventos enviados ao cliente (SSE), na ordem em que acontecem. */
export type EventoOrquestrador =
  | { type: 'rota'; rota: Rota; motivo: string }
  | { type: 'execucao'; execucaoId: string }
  | { type: 'plano'; plano: Plano }
  | { type: 'etapa'; etapa: EtapaEvento }
  /** A execução pausou: estas escritas esperam aprovação. */
  | { type: 'aprovacao'; execucaoId: string; aprovacoes: AprovacaoParaCliente[] }
  /** Decisão registrada, mas ainda há outras aprovações pendentes. */
  | { type: 'aguardando'; execucaoId: string; pendentes: number }
  | {
      type: 'resposta';
      resposta: string;
      fontes: Fonte[];
      origem: 'vault' | 'web';
      conversaId?: string;
      mensagemId?: string;
      execucaoId?: string;
    }
  | { type: 'error'; message: string };

type Emitir = (e: EventoOrquestrador) => void;

/** O que a execução precisa lembrar do pedido para terminar depois de uma pausa. */
interface PedidoSalvo {
  conversaId?: string;
  modo?: ModoBusca;
  agentesSistema?: string[] | null;
}

/** Conteúdo de `Execucao.estado` enquanto a execução está pausada. */
interface EstadoSalvo {
  executor: EstadoExecutor;
  pedido: PedidoSalvo;
  tokens: LlmUsage;
}

/**
 * Modo do caminho direto. Escolha explícita do usuário vale; "auto" (ou
 * nada) usa a fonte decidida pelo roteador; sem ela, o próprio Assistente
 * classifica (modo "auto" do /ai/prompt).
 */
export function modoDireto(
  pedido: ModoBusca | undefined,
  fonteRoteador: 'memoria' | 'web' | undefined,
): ModoBusca {
  if (pedido === 'vault' || pedido === 'web') return pedido;
  if (fonteRoteador === 'web') return 'web';
  if (fonteRoteador === 'memoria') return 'vault';
  return 'auto';
}

/** Teto de cada resposta antiga no histórico mandado ao modelo. */
const RESPOSTA_HISTORICO_CHARS = 4000;

/**
 * Converte o histórico do Assistente (pares pergunta/resposta) em mensagens
 * nativas, e acrescenta o pedido atual com as referências do cliente.
 */
export function mensagensIniciais(
  historico: HistoricoTurno[],
  texto: string,
  referencia?: string,
): MensagemComFerramentas[] {
  const msgs: MensagemComFerramentas[] = [];
  for (const t of historico) {
    msgs.push({ papel: 'user', blocos: [{ tipo: 'texto', texto: t.pergunta }] });
    msgs.push({
      papel: 'assistant',
      blocos: [{ tipo: 'texto', texto: t.resposta.slice(0, RESPOSTA_HISTORICO_CHARS) }],
    });
  }
  const ref = referencia?.trim();
  msgs.push({
    papel: 'user',
    blocos: [
      {
        tipo: 'texto',
        texto: ref
          ? `## REFERÊNCIAS (Notas / To-do's do usuário)\n${ref}\n\n## PEDIDO\n${texto}`
          : texto,
      },
    ],
  });
  return msgs;
}

/**
 * Ponto de entrada do orquestrador. Pedidos simples seguem o fluxo direto do
 * Assistente (PromptService, sem nada novo no caminho); pedidos de várias
 * etapas viram uma Execucao: plano, loop com ferramentas, resposta gravada
 * na conversa.
 *
 * Uma escrita PAUSA a execução (`aguardando_aprovacao`, estado salvo); a
 * decisão do usuário (`decidir`) a retoma de onde parou. A execução não
 * depende da conexão: se o cliente sair, ela termina e a resposta fica
 * gravada na conversa.
 */
@Injectable()
export class OrquestradorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrquestradorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prompt: PromptService,
    private readonly conversas: ConversasService,
    private readonly roteador: RoteadorService,
    private readonly planejador: PlanejadorService,
    private readonly executor: ExecutorService,
    private readonly auditoria: AuditoriaService,
    private readonly revisor: RevisorSegurancaService,
    private readonly registro: RegistroFerramentasService,
    /** Opcional: ausente nos specs antigos e quando o módulo desktop não existe. */
    @Optional() private readonly comandos?: ComandosDesktopService,
  ) {}

  /** Nunca derruba o pedido: na dúvida, segue o fluxo normal. */
  private async interpretarComando(p: PedidoOrquestrador, texto: string): Promise<DecisaoComando> {
    if (!this.comandos || p.modo === 'vault') return null;
    try {
      return await this.comandos.interpretar(p.user, texto, p.alternativas ?? [], p.origem);
    } catch (err) {
      this.logger.warn(`Falha ao interpretar comando de computador: ${String(err)}`);
      return null;
    }
  }

  /**
   * Execuções que estavam rodando quando a API caiu não têm mais quem as
   * termine: viram `interrompida` (a retomada vem numa etapa posterior). As
   * que estão `aguardando_aprovacao` não rodavam e seguem esperando.
   *
   * Uma etapa de escrita pega no meio vira `falhou` e NUNCA é repetida
   * sozinha: não há como saber se o efeito aconteceu antes da queda.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const presas = await this.prisma.execucao.findMany({
        where: { status: { in: ['planejando', 'executando'] } },
        select: { id: true, empresaId: true },
      });
      if (presas.length === 0) return;
      await this.prisma.$transaction([
        this.prisma.execucao.updateMany({
          where: { id: { in: presas.map((e) => e.id) } },
          data: { status: 'interrompida', erro: 'A API reiniciou durante a execução.' },
        }),
        this.prisma.etapaExecucao.updateMany({
          where: { execucaoId: { in: presas.map((e) => e.id) }, status: 'executando' },
          data: { status: 'falhou', erro: 'Interrompida pelo reinício da API.' },
        }),
        this.prisma.registroAuditoria.createMany({
          data: presas.map((e) => ({
            empresaId: e.empresaId,
            execucaoId: e.id,
            evento: 'execucao.interrompida',
          })),
        }),
      ]);
      this.logger.warn(`${presas.length} execução(ões) marcadas como interrompidas.`);
    } catch (err) {
      this.logger.error(`Falha ao marcar execuções interrompidas: ${String(err)}`);
    }
  }

  async orquestrar(p: PedidoOrquestrador, emitir: Emitir): Promise<void> {
    const texto = p.texto.trim();

    // Comandos de computador ("abrir Figma", "próxima música"): reconhecidos
    // de forma determinística, ANTES do roteador — nunca viram pesquisa.
    const comando = await this.interpretarComando(p, texto);
    if (comando?.acao === 'responder') {
      emitir({ type: 'rota', rota: 'direta', motivo: 'comando de computador' });
      const salvo = await this.gravarNaConversa(p.user, { conversaId: p.conversaId, modo: p.modo }, p.repositorioId, texto, comando.resposta, [], 'vault', null);
      emitir({ type: 'resposta', resposta: comando.resposta, fontes: [], origem: 'vault', ...salvo });
      return;
    }
    if (comando?.acao === 'executar') {
      emitir({ type: 'rota', rota: 'plano', motivo: `comando: ${comando.entendido}` });
      await this.executarPlano(p, comando.texto, undefined, emitir, { entendido: comando.entendido, chamada: comando.chamada });
      return;
    }
    if (comando?.acao === 'planejar') {
      emitir({ type: 'rota', rota: 'plano', motivo: 'arquivos no computador' });
      await this.executarPlano(p, texto, undefined, emitir);
      return;
    }

    const decisao = await this.roteador.decidir(p.user, texto, p.historico);
    emitir({ type: 'rota', rota: decisao.rota, motivo: decisao.motivo });

    if (decisao.rota === 'direta') {
      // O caminho de hoje do /ai/prompt. A fonte: a que o usuário escolheu
      // (Repositório ou Web); sem escolha ("auto"), a que o roteador já
      // decidiu — evita uma segunda classificação.
      const r = await this.prompt.responder({
        user: p.user,
        texto,
        modo: modoDireto(p.modo, decisao.fonte),
        historico: p.historico,
        referencia: p.referencia,
        conversaId: p.conversaId,
        repositorioId: p.repositorioId ?? undefined,
        organizacaoId: p.organizacaoId,
        mencoes: [],
        respostaAdicional: false,
      });
      emitir({
        type: 'resposta',
        resposta: r.resposta,
        fontes: r.fontes,
        origem: r.origem,
        conversaId: r.conversaId,
        mensagemId: r.mensagemId,
      });
      return;
    }

    await this.executarPlano(p, texto, decisao.usage, emitir);
  }

  private async executarPlano(
    p: PedidoOrquestrador,
    texto: string,
    usageRota: LlmUsage | undefined,
    emitir: Emitir,
    comando?: ComandoDireto,
  ): Promise<void> {
    const { user } = p;
    const execucao = await this.prisma.execucao.create({
      data: {
        empresaId: user.empresaId,
        usuarioId: user.id,
        organizacaoId: p.organizacaoId,
        repositorioId: p.repositorioId,
        pedido: texto,
        status: 'planejando',
        // SR-06c: referências ou histórico = conteúdo além do pedido. O comando
        // direto roda SEM histórico nem referências (só o texto do usuário).
        contextoExterno: comando ? false : !!p.referencia?.trim() || p.historico.length > 0,
        origem: p.origem ?? 'texto',
      },
    });
    emitir({ type: 'execucao', execucaoId: execucao.id });
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId: execucao.id,
      evento: 'execucao.criada',
      // GC-02: o que a pessoa disse e o que foi usado (quando o ditado trouxe alternativas).
      ...(comando
        ? {
            detalhes: {
              comandoDireto: comando.entendido,
              textoOriginal: p.texto.slice(0, 300),
              ...(texto !== p.texto.trim() ? { alternativaUsada: texto.slice(0, 300) } : {}),
              origem: p.origem ?? 'texto',
            },
          }
        : {}),
    });

    const pedido: PedidoSalvo = {
      conversaId: p.conversaId,
      modo: p.modo,
      agentesSistema: p.agentesSistema ?? null,
    };
    const tokens: LlmUsage = { entrada: usageRota?.entrada ?? 0, saida: usageRota?.saida ?? 0 };
    try {
      const mensagens = comando ? mensagensIniciais([], texto) : mensagensIniciais(p.historico, texto, p.referencia);
      // Checkpoint zero, antes de planejar: guarda o histórico e as
      // referências (que o cliente não reenviaria) para uma eventual retomada.
      const checkpoint = this.checkpoint(execucao.id, pedido, tokens);
      await checkpoint(estadoInicial(mensagens), { entrada: 0, saida: 0 });
      const plano = comando
        ? await this.planoDoComando(execucao.id, comando, emitir)
        : await this.planejarExecucao(user, execucao.id, texto, mensagens, tokens, emitir, pedido.modo === 'vault');

      const r = await this.executor.executar({
        execucaoId: execucao.id,
        pedido: texto,
        ctx: {
          user,
          organizacaoId: p.organizacaoId,
          repositorioId: p.repositorioId,
          agentesSistema: pedido.agentesSistema,
          // "Buscar no seu Repositório" (e insights/briefing): sem web nem contas conectadas.
          somenteRepositorio: pedido.modo === 'vault',
        },
        plano: planoEmTexto(plano),
        mensagens,
        aoEtapa: (etapa) => emitir({ type: 'etapa', etapa }),
        aoCheckpoint: this.checkpoint(execucao.id, pedido, tokens),
        // Ações no computador costumam ser sequências (achar → abrir → organizar).
        // Comando direto: a ação e uma resposta curta, nada além.
        limites: comando
          ? { ...LIMITES_PADRAO, maxTurnos: 2, maxChamadas: 1 }
          : plano.etapas.some((e) => e.ferramenta?.startsWith('desktop_')) ? LIMITES_DESKTOP : undefined,
        ...(comando ? { primeiraChamada: { id: 'comando_direto', nome: comando.chamada.nome, entrada: comando.chamada.entrada } } : {}),
      });
      await this.desfecho(
        { id: execucao.id, pedido: texto, repositorioId: p.repositorioId },
        user,
        pedido,
        tokens,
        r,
        emitir,
      );
    } catch (err) {
      await this.falhar(execucao.id, user, tokens, err, emitir);
    }
  }

  /** Plano fixo de um comando direto (sem chamar o planejador). */
  private async planoDoComando(execucaoId: string, comando: ComandoDireto, emitir: Emitir): Promise<Plano> {
    const plano: Plano = {
      objetivo: `Comando do usuário: ${comando.entendido}`,
      etapas: [
        { chave: 'e1', descricao: `Entendi: ${comando.entendido}`, ferramenta: comando.chamada.nome, dependeDe: [] },
        { chave: 'e2', descricao: 'Confirmar ao usuário em uma frase curta', ferramenta: null, dependeDe: ['e1'] },
      ],
    };
    await this.prisma.execucao.update({
      where: { id: execucaoId },
      data: { status: 'executando', plano: { ...plano, comandoDireto: true } as unknown as Prisma.InputJsonValue },
    });
    emitir({ type: 'plano', plano });
    return plano;
  }

  /** Planeja, revisa o plano se houver escrita, grava e emite. Soma os tokens. */
  private async planejarExecucao(
    user: AuthenticatedUser,
    execucaoId: string,
    texto: string,
    mensagens: MensagemComFerramentas[],
    tokens: LlmUsage,
    emitir: Emitir,
    somenteRepositorio: boolean,
  ): Promise<Plano> {
    const { plano, padrao, usage } = await this.planejador.planejar(
      user,
      texto,
      mensagens,
      somenteRepositorio,
    );
    tokens.entrada += usage?.entrada ?? 0;
    tokens.saida += usage?.saida ?? 0;
    const revisaoPlano = await this.revisarPlano(user, execucaoId, texto, plano);
    await this.prisma.execucao.update({
      where: { id: execucaoId },
      data: {
        status: 'executando',
        plano: {
          ...plano,
          padrao,
          ...(revisaoPlano ? { revisao: revisaoPlano } : {}),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    emitir({ type: 'plano', plano });
    return plano;
  }

  /**
   * Grava o estado do executor em `Execucao.estado` (com o pedido e os
   * tokens até ali). É o que permite retomar depois de uma queda da API.
   * Falha ao gravar não derruba a execução — só a deixa sem retomada.
   */
  private checkpoint(execucaoId: string, pedido: PedidoSalvo, base: LlmUsage): AoCheckpoint {
    return async (estado, usage) => {
      const tokens = { entrada: base.entrada + usage.entrada, saida: base.saida + usage.saida };
      const salvo: EstadoSalvo = { executor: estado, pedido, tokens };
      try {
        await this.prisma.execucao.update({
          where: { id: execucaoId },
          data: { estado: salvo as unknown as Prisma.InputJsonValue },
        });
      } catch (err) {
        this.logger.warn(`Falha ao gravar checkpoint da execução ${execucaoId}: ${String(err)}`);
      }
    };
  }

  /**
   * Retoma uma execução `interrompida` (a API caiu no meio) do último
   * checkpoint. Escritas que estavam rodando na queda NUNCA são repetidas:
   * o modelo é avisado de que não se sabe se aconteceram.
   */
  async retomarInterrompida(user: AuthenticatedUser, execucaoId: string, emitir: Emitir): Promise<void> {
    const existe = await this.prisma.execucao.findFirst({
      where: { id: execucaoId, empresaId: user.empresaId, usuarioId: user.id },
      select: { status: true },
    });
    if (!existe) throw new NotFoundException('Execução não encontrada.');
    if (existe.status !== 'interrompida') {
      throw new ConflictException('Só uma execução interrompida pode ser retomada.');
    }
    const reivindicada = await this.prisma.execucao.updateMany({
      where: { id: execucaoId, usuarioId: user.id, status: 'interrompida' },
      data: { status: 'executando', erro: null },
    });
    if (reivindicada.count === 0) throw new ConflictException('Esta execução já foi retomada.');
    emitir({ type: 'execucao', execucaoId });
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId,
      evento: 'execucao.retomada',
    });

    const execucao = await this.prisma.execucao.findUniqueOrThrow({
      where: { id: execucaoId },
      select: { id: true, pedido: true, plano: true, estado: true, organizacaoId: true, repositorioId: true },
    });
    const salvo = execucao.estado as unknown as EstadoSalvo | null;
    const tokens: LlmUsage = { ...(salvo?.tokens ?? { entrada: 0, saida: 0 }) };
    try {
      if (!salvo?.executor) throw new ConflictException('Esta execução não tem estado salvo para retomar.');
      // Caiu antes do plano ficar pronto: planeja de novo com o histórico salvo.
      const plano =
        (execucao.plano as unknown as Plano | null) ??
        (await this.planejarExecucao(
          user,
          execucao.id,
          execucao.pedido,
          salvo.executor.mensagens,
          tokens,
          emitir,
          salvo.pedido.modo === 'vault',
        ));
      if (execucao.plano) {
        await this.prisma.execucao.update({ where: { id: execucao.id }, data: { status: 'executando' } });
      }
      const comum = {
        execucaoId: execucao.id,
        pedido: execucao.pedido,
        ctx: {
          user,
          organizacaoId: execucao.organizacaoId,
          repositorioId: execucao.repositorioId,
          agentesSistema: salvo.pedido.agentesSistema ?? null,
          somenteRepositorio: salvo.pedido.modo === 'vault',
        },
        plano: planoEmTexto(plano),
        // Cada retomada ganha um número: as etapas novas não colidem com as
        // que o turno perdido na queda tenha chegado a criar.
        estado: { ...salvo.executor, retomadas: (salvo.executor.retomadas ?? 0) + 1 },
        aoEtapa: (etapa: EtapaEvento) => emitir({ type: 'etapa', etapa }),
        aoCheckpoint: this.checkpoint(execucao.id, salvo.pedido, tokens),
      };
      const r = salvo.executor.pendente
        ? await this.executor.retomar({ ...comum, decisoes: await this.decisoesAposQueda(salvo.executor) })
        : await this.executor.continuar(comum);
      await this.desfecho(
        { id: execucao.id, pedido: execucao.pedido, repositorioId: execucao.repositorioId },
        user,
        salvo.pedido,
        tokens,
        r,
        emitir,
      );
    } catch (err) {
      await this.falhar(execucao.id, user, tokens, err, emitir);
    }
  }

  /**
   * Estado parado em aprovações quando a API caiu (a decisão foi registrada e
   * a retomada estava em curso). Para cada uma, o que o banco diz que
   * aconteceu: já concluída, negada/expirada, ou interrompida no meio.
   */
  private async decisoesAposQueda(estado: EstadoExecutor): Promise<Map<string, DecisaoGravada>> {
    const pendente = estado.pendente!;
    const [aprovacoes, etapas] = await Promise.all([
      this.prisma.aprovacaoAcao.findMany({
        where: { id: { in: pendente.aguardando.map((a) => a.aprovacaoId) } },
        select: { id: true, status: true, entrada: true, hashEntrada: true, motivo: true },
      }),
      this.prisma.etapaExecucao.findMany({
        where: { id: { in: pendente.aguardando.map((a) => a.etapaId) } },
        select: { id: true, status: true, saida: true },
      }),
    ]);
    const decisoes = new Map<string, DecisaoGravada>();
    for (const a of pendente.aguardando) {
      const ap = aprovacoes.find((x) => x.id === a.aprovacaoId);
      const et = etapas.find((x) => x.id === a.etapaId);
      if (!ap) continue;
      const base = {
        entrada: ap.entrada as Record<string, unknown>,
        hashEntrada: ap.hashEntrada,
        motivo: ap.motivo,
      };
      if (et?.status === 'concluida') {
        const saida = et.saida as { conteudo?: string } | null;
        decisoes.set(a.aprovacaoId, { ...base, status: 'concluida', conteudo: saida?.conteudo ?? '' });
      } else if (ap.status === 'aprovada') {
        // Aprovada e não concluída: estava rodando (ou ia rodar) na queda.
        decisoes.set(a.aprovacaoId, { ...base, status: 'interrompida' });
      } else if (ap.status === 'negada' || ap.status === 'expirada') {
        decisoes.set(a.aprovacaoId, { ...base, status: ap.status });
      }
    }
    return decisoes;
  }

  /**
   * Descarta uma execução parada (esperando aprovação ou interrompida). As
   * aprovações pendentes viram negadas; nada é executado.
   */
  async cancelar(user: AuthenticatedUser, execucaoId: string): Promise<{ ok: true }> {
    const existe = await this.prisma.execucao.findFirst({
      where: { id: execucaoId, empresaId: user.empresaId, usuarioId: user.id },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Execução não encontrada.');
    const agora = new Date();
    const { count } = await this.prisma.execucao.updateMany({
      where: { id: execucaoId, usuarioId: user.id, status: { in: ['aguardando_aprovacao', 'interrompida'] } },
      data: { status: 'cancelada', estado: Prisma.DbNull, concluidaEm: agora },
    });
    if (count === 0) throw new ConflictException('Só uma execução parada pode ser descartada.');
    await this.prisma.aprovacaoAcao.updateMany({
      where: { execucaoId, status: 'pendente' },
      data: { status: 'negada', decididoPorId: user.id, decididoEm: agora, motivo: 'Execução descartada pelo usuário.' },
    });
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId,
      evento: 'execucao.cancelada',
    });
    return { ok: true };
  }

  /**
   * Execuções do usuário que ainda pedem algo dele (últimos 7 dias): paradas
   * em aprovação, interrompidas por queda, ou ainda rodando (ex.: o cliente
   * fechou o painel no meio).
   */
  async abertas(user: AuthenticatedUser) {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lista = await this.prisma.execucao.findMany({
      where: {
        empresaId: user.empresaId,
        usuarioId: user.id,
        status: { in: ['aguardando_aprovacao', 'interrompida', 'executando', 'planejando'] },
        criadoEm: { gte: desde },
      },
      orderBy: { criadoEm: 'desc' },
      take: 20,
      select: {
        id: true,
        pedido: true,
        status: true,
        criadoEm: true,
        estado: true,
        etapas: {
          orderBy: { ordem: 'asc' },
          select: { chave: true, ferramenta: true, descricao: true, status: true, erro: true },
        },
        aprovacoes: {
          where: { status: 'pendente' },
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            ferramenta: true,
            resumo: true,
            entrada: true,
            expiraEm: true,
            revisao: true,
            etapa: { select: { chave: true } },
          },
        },
      },
    });
    return lista.map(({ estado, aprovacoes, ...e }) => ({
      ...e,
      // Interrompida sem estado salvo (anterior aos checkpoints) não retoma.
      retomavel: e.status === 'interrompida' && !!(estado as EstadoSalvo | null)?.executor,
      aprovacoes: aprovacoes.map(({ etapa, ...a }) => ({ ...a, chave: etapa.chave })),
    }));
  }

  /**
   * Parecer do revisor sobre o plano, só quando ele prevê escritas (um plano
   * só de leituras não tem o que revisar). É registro, não freio: cada
   * escrita ainda é revisada e aprovada individualmente na hora de rodar.
   */
  private async revisarPlano(
    user: AuthenticatedUser,
    execucaoId: string,
    pedido: string,
    plano: Plano,
  ): Promise<Parecer | null> {
    const escritas = plano.etapas.filter((e) => {
      const risco = e.ferramenta ? this.registro.perfil(e.ferramenta)?.risco : undefined;
      return risco && risco !== 'leitura';
    });
    if (escritas.length === 0) return null;
    const parecer = await this.revisor.revisarPlano(user, pedido, planoEmTexto(plano));
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId,
      evento: 'revisao.plano',
      detalhes: parecer as unknown as Prisma.InputJsonValue,
    });
    return parecer;
  }

  /**
   * Registra a decisão do usuário sobre uma aprovação e, se era a última
   * pendente da execução, retoma a execução de onde parou.
   *
   * Só quem pediu decide (404 para qualquer outro). A transição de cada
   * registro é condicional (`pendente → …`, `aguardando_aprovacao →
   * executando`): duas decisões simultâneas não executam a ação duas vezes.
   */
  async decidir(
    user: AuthenticatedUser,
    aprovacaoId: string,
    aprovar: boolean,
    motivo: string | undefined,
    emitir: Emitir,
  ): Promise<void> {
    const ap = await this.prisma.aprovacaoAcao.findFirst({
      where: { id: aprovacaoId, empresaId: user.empresaId, solicitanteId: user.id },
      select: { id: true, status: true, expiraEm: true, execucaoId: true, ferramenta: true, risco: true },
    });
    if (!ap) throw new NotFoundException('Aprovação não encontrada.');
    if (ap.status !== 'pendente') throw new ConflictException('Esta aprovação já foi decidida.');

    const agora = new Date();
    const status = ap.expiraEm <= agora ? 'expirada' : aprovar ? 'aprovada' : 'negada';
    const { count } = await this.prisma.aprovacaoAcao.updateMany({
      where: { id: ap.id, status: 'pendente' },
      data: { status, decididoPorId: user.id, decididoEm: agora, motivo: motivo?.trim() || null },
    });
    if (count === 0) throw new ConflictException('Esta aprovação já foi decidida.');
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId: ap.execucaoId,
      evento:
        status === 'aprovada'
          ? 'aprovacao.concedida'
          : status === 'negada'
            ? 'aprovacao.negada'
            : 'aprovacao.expirada',
      ferramenta: ap.ferramenta,
      risco: ap.risco,
      detalhes: { aprovacaoId: ap.id, ...(motivo?.trim() ? { motivo: motivo.trim() } : {}) },
    });

    const pendentes = await this.prisma.aprovacaoAcao.count({
      where: { execucaoId: ap.execucaoId, status: 'pendente' },
    });
    if (pendentes > 0) {
      emitir({ type: 'aguardando', execucaoId: ap.execucaoId, pendentes });
      return;
    }

    // Última decisão: quem tirar a execução de `aguardando_aprovacao` retoma.
    const reivindicada = await this.prisma.execucao.updateMany({
      where: { id: ap.execucaoId, usuarioId: user.id, status: 'aguardando_aprovacao' },
      data: { status: 'executando' },
    });
    if (reivindicada.count === 0) throw new ConflictException('Esta execução já foi retomada.');
    emitir({ type: 'execucao', execucaoId: ap.execucaoId });

    const execucao = await this.prisma.execucao.findUniqueOrThrow({
      where: { id: ap.execucaoId },
      select: { id: true, pedido: true, plano: true, estado: true, organizacaoId: true, repositorioId: true },
    });
    const salvo = execucao.estado as unknown as EstadoSalvo | null;
    const tokens: LlmUsage = { ...(salvo?.tokens ?? { entrada: 0, saida: 0 }) };
    try {
      if (!salvo?.executor?.pendente) throw new Error('Estado da execução ausente.');
      const decididas = await this.prisma.aprovacaoAcao.findMany({
        where: { id: { in: salvo.executor.pendente.aguardando.map((a) => a.aprovacaoId) } },
        select: { id: true, status: true, entrada: true, hashEntrada: true, motivo: true },
      });
      const decisoes = new Map<string, DecisaoGravada>(
        decididas
          .filter((d) => d.status !== 'pendente')
          .map((d) => [
            d.id,
            {
              status: d.status as DecisaoGravada['status'],
              entrada: d.entrada as Record<string, unknown>,
              hashEntrada: d.hashEntrada,
              motivo: d.motivo,
            },
          ]),
      );
      const r = await this.executor.retomar({
        execucaoId: execucao.id,
        pedido: execucao.pedido,
        // Escopo da execução, não da requisição: trocar de organização entre
        // o pedido e a aprovação não muda onde a ação acontece.
        ctx: {
          user,
          organizacaoId: execucao.organizacaoId,
          repositorioId: execucao.repositorioId,
          agentesSistema: salvo.pedido.agentesSistema ?? null,
          somenteRepositorio: salvo.pedido.modo === 'vault',
        },
        plano: execucao.plano ? planoEmTexto(execucao.plano as unknown as Plano) : '',
        estado: salvo.executor,
        decisoes,
        aoEtapa: (etapa) => emitir({ type: 'etapa', etapa }),
        aoCheckpoint: this.checkpoint(execucao.id, salvo.pedido, tokens),
      });
      await this.desfecho(
        { id: execucao.id, pedido: execucao.pedido, repositorioId: execucao.repositorioId },
        user,
        salvo.pedido,
        tokens,
        r,
        emitir,
      );
    } catch (err) {
      await this.falhar(execucao.id, user, tokens, err, emitir);
    }
  }

  /** Fim de um trecho do executor: pausa de novo, ou conclui e grava a resposta. */
  private async desfecho(
    execucao: { id: string; pedido: string; repositorioId: string | null },
    user: AuthenticatedUser,
    pedido: PedidoSalvo,
    tokens: LlmUsage,
    r: ResultadoExecutor,
    emitir: Emitir,
  ): Promise<void> {
    tokens.entrada += r.usage.entrada;
    tokens.saida += r.usage.saida;

    if (r.tipo === 'pausa') {
      const estado: EstadoSalvo = { executor: r.estado, pedido, tokens };
      await this.prisma.execucao.update({
        where: { id: execucao.id },
        data: {
          status: 'aguardando_aprovacao',
          estado: estado as unknown as Prisma.InputJsonValue,
          tokensEntrada: tokens.entrada,
          tokensSaida: tokens.saida,
        },
      });
      await this.auditoria.registrar({
        empresaId: user.empresaId,
        usuarioId: user.id,
        execucaoId: execucao.id,
        evento: 'execucao.pausada',
        detalhes: { aprovacoes: r.aprovacoes.map((a) => a.aprovacaoId) },
      });
      emitir({
        type: 'aprovacao',
        execucaoId: execucao.id,
        aprovacoes: r.aprovacoes.map((a) => ({
          id: a.aprovacaoId,
          chave: a.chave,
          ferramenta: a.ferramenta,
          resumo: a.resumo,
          entrada: a.entrada,
          expiraEm: a.expiraEm,
          revisao: a.revisao,
        })),
      });
      return;
    }

    // Só web e nada da memória → origem web; o resto conta como Memória.
    const origem: 'vault' | 'web' =
      r.ferramentasUsadas.includes('buscar_web') && !r.ferramentasUsadas.includes('buscar_memoria')
        ? 'web'
        : 'vault';
    const salvo = await this.gravarNaConversa(
      user,
      pedido,
      execucao.repositorioId,
      execucao.pedido,
      r.resposta,
      r.fontes,
      origem,
      execucao.id,
    );
    await this.prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: 'concluida',
        resultado: r.resposta,
        estado: Prisma.DbNull,
        conversaId: salvo.conversaId ?? null,
        tokensEntrada: tokens.entrada,
        tokensSaida: tokens.saida,
        concluidaEm: new Date(),
      },
    });
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId: execucao.id,
      evento: 'execucao.concluida',
      detalhes: { tokens: { ...tokens }, limite: r.limiteAtingido ?? null },
    });
    emitir({
      type: 'resposta',
      resposta: r.resposta,
      fontes: r.fontes,
      origem,
      conversaId: salvo.conversaId,
      mensagemId: salvo.mensagemId,
      execucaoId: execucao.id,
    });
  }

  private async falhar(
    execucaoId: string,
    user: AuthenticatedUser,
    tokens: LlmUsage,
    err: unknown,
    emitir: Emitir,
  ): Promise<void> {
    const mensagem = err instanceof HttpException ? err.message : 'Falha ao executar o pedido.';
    this.logger.error(`Execução ${execucaoId} falhou: ${String(err)}`);
    await this.prisma.execucao
      .update({
        where: { id: execucaoId },
        data: {
          status: 'falhou',
          erro: mensagem,
          tokensEntrada: tokens.entrada,
          tokensSaida: tokens.saida,
          concluidaEm: new Date(),
        },
      })
      .catch(() => undefined);
    await this.auditoria.registrar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      execucaoId,
      evento: 'execucao.falhou',
      detalhes: { erro: mensagem },
    });
    emitir({ type: 'error', message: mensagem });
  }

  /** Mesmo formato de gravação do Assistente, com o id da execução no meta. */
  private async gravarNaConversa(
    user: AuthenticatedUser,
    pedido: PedidoSalvo,
    repositorioId: string | null,
    pergunta: string,
    resposta: string,
    fontes: Fonte[],
    origem: 'vault' | 'web',
    execucaoId: string | null,
  ): Promise<{ conversaId?: string; mensagemId?: string }> {
    try {
      const r = await this.conversas.persistPromptTurn({
        empresaId: user.empresaId,
        usuarioId: user.id,
        conversaId: pedido.conversaId,
        repositorioId,
        modo: pedido.modo ?? 'auto',
        pergunta,
        resposta,
        fontes,
        origemResposta: origem,
        agente: null,
        ...(execucaoId ? { execucaoId } : {}),
      });
      // Conversa nova: mesmo título resumido que o caminho direto ganha.
      if (r.nova) this.prompt.refinarTitulo(user, r.conversaId, pergunta, resposta);
      return { conversaId: r.conversaId, mensagemId: r.mensagemId };
    } catch (err) {
      this.logger.warn(`Falha ao gravar a resposta da execução na conversa: ${String(err)}`);
      return { conversaId: pedido.conversaId };
    }
  }

  /** Estado de uma execução com as etapas e aprovações — só para o dono. */
  async obter(user: AuthenticatedUser, id: string) {
    const execucao = await this.prisma.execucao.findFirst({
      where: { id, empresaId: user.empresaId, usuarioId: user.id },
      select: {
        id: true,
        pedido: true,
        status: true,
        plano: true,
        resultado: true,
        erro: true,
        conversaId: true,
        tokensEntrada: true,
        tokensSaida: true,
        criadoEm: true,
        concluidaEm: true,
        etapas: {
          orderBy: { ordem: 'asc' },
          select: {
            chave: true,
            ordem: true,
            tipo: true,
            ferramenta: true,
            descricao: true,
            dependeDe: true,
            status: true,
            erro: true,
            iniciadaEm: true,
            concluidaEm: true,
          },
        },
        aprovacoes: {
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            ferramenta: true,
            resumo: true,
            entrada: true,
            status: true,
            expiraEm: true,
            decididoEm: true,
          },
        },
      },
    });
    if (!execucao) throw new NotFoundException('Execução não encontrada.');
    return execucao;
  }
}
