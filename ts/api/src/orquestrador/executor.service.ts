import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AiService } from '@/ai/ai.service';
import type { LlmUsage } from '@/ai/providers';
import type { Fonte } from '@/ai/prompt.service';
import type {
  BlocoConversa,
  ChamadaFerramenta,
  MensagemComFerramentas,
} from '@/ai/tool-use';
import { PrismaService } from '@/prisma/prisma.service';
import { RegistroFerramentasService } from './ferramentas/registro.service';
import type { ContextoFerramenta } from './ferramentas/ferramenta';
import { AuditoriaService } from './auditoria.service';
import { hashEntrada, PoliticaExecucaoService, type Decisao, type Pode } from './politica.service';
import { systemExecutor } from './prompts';
import { RevisorSegurancaService, type Parecer } from './revisor.service';

/** Freios de uma execução. Atingido qualquer um, o próximo turno só responde. */
export interface Limites {
  /** Chamadas ao modelo no loop (a última é sempre a resposta). */
  maxTurnos: number;
  /** Chamadas de ferramenta somadas na execução inteira. */
  maxChamadas: number;
  /** Tokens (entrada + saída) somados nas chamadas do loop. */
  orcamentoTokens: number;
  /** Ferramentas rodando ao mesmo tempo. */
  concorrencia: number;
  /** Teto de saída por turno. */
  maxTokensTurno: number;
}

export const LIMITES_PADRAO: Limites = {
  maxTurnos: 6,
  maxChamadas: 12,
  orcamentoTokens: 120_000,
  concorrencia: 3,
  maxTokensTurno: 3000,
};

/** Execuções que planejam ações no computador (sequências mais longas). */
export const LIMITES_DESKTOP: Limites = { ...LIMITES_PADRAO, maxTurnos: 10, maxChamadas: 20 };

/** Resposta ao modelo quando ele tenta sair do repositório numa conversa restrita. */
export const MOTIVO_SOMENTE_REPOSITORIO =
  'Nesta conversa o usuário quer respostas só com base no repositório dele: não use a internet nem contas conectadas (e-mail, agenda, Drive). ' +
  'Responda com o que há na memória e diga o que ficou faltando.';

/** Validade de um pedido de aprovação. */
export const VALIDADE_APROVACAO_MS = 24 * 60 * 60 * 1000;

export type StatusEtapaEvento =
  | 'executando'
  | 'concluida'
  | 'falhou'
  | 'aguardando_aprovacao'
  | 'negada';

export interface EtapaEvento {
  chave: string;
  ferramenta: string;
  descricao: string;
  status: StatusEtapaEvento;
  erro?: string;
}

/** Uma escrita parada à espera do usuário. */
export interface AprovacaoPendente {
  aprovacaoId: string;
  etapaId: string;
  chave: string;
  /** Posição da chamada no turno (para devolver o resultado no lugar certo). */
  indice: number;
  idChamada: string;
  ferramenta: string;
  /** Entrada normalizada — exatamente o que o usuário vai aprovar. */
  entrada: Record<string, unknown>;
  resumo: string;
  expiraEm: string;
  /** Parecer do revisor de segurança (consultivo), mostrado no pedido. */
  revisao: Parecer;
}

type LimiteAtingido = 'turnos' | 'chamadas' | 'tokens';

/**
 * Tudo o que o loop precisa para continuar depois de uma pausa. Vai inteiro
 * para `Execucao.estado` (JSON), então só tipos serializáveis.
 */
export interface EstadoExecutor {
  versao: 1;
  /** Turno em que a execução parou (o próximo a rodar é este + 1). */
  turno: number;
  mensagens: MensagemComFerramentas[];
  usage: LlmUsage;
  fontes: [string, Fonte][];
  usadas: string[];
  chamadasFeitas: number;
  ordem: number;
  anteriores: string[];
  limiteAtingido?: LimiteAtingido;
  /** Quantas vezes a execução foi retomada após queda (entra nas chaves das etapas). */
  retomadas?: number;
  /** O turno parado: resultados já prontos (null = aguardando) e as pendências. */
  pendente?: {
    blocos: (BlocoConversa | null)[];
    aguardando: AprovacaoPendente[];
    etapasTurno: string[];
  };
}

export type ResultadoExecutor =
  | {
      tipo: 'resposta';
      resposta: string;
      fontes: Fonte[];
      /** Ferramentas que deram certo (para decidir a origem da resposta). */
      ferramentasUsadas: string[];
      /** Tokens desta chamada a executar/retomar (não acumulado). */
      usage: LlmUsage;
      limiteAtingido?: LimiteAtingido;
    }
  | {
      tipo: 'pausa';
      aprovacoes: AprovacaoPendente[];
      estado: EstadoExecutor;
      usage: LlmUsage;
    };

/** Decisão do usuário sobre uma aprovação, já gravada. */
export interface DecisaoGravada {
  /**
   * `interrompida`: aprovada, mas a API caiu durante a ação — não se sabe se
   * aconteceu, então NUNCA é repetida. `concluida`: a ação já rodou antes da
   * queda; o resultado gravado é reaproveitado.
   */
  status: 'aprovada' | 'negada' | 'expirada' | 'interrompida' | 'concluida';
  entrada: Record<string, unknown>;
  hashEntrada: string;
  motivo?: string | null;
  /** Resultado gravado, quando `concluida`. */
  conteudo?: string;
}

/** Chamado ao fim de cada turno com o estado para gravar (retomada após queda). */
export type AoCheckpoint = (estado: EstadoExecutor, usage: LlmUsage) => Promise<void>;

/** Estado antes do primeiro turno: só o histórico inicial. */
export function estadoInicial(mensagens: MensagemComFerramentas[]): EstadoExecutor {
  return {
    versao: 1,
    turno: 0,
    mensagens: [...mensagens],
    usage: { entrada: 0, saida: 0 },
    fontes: [],
    usadas: [],
    chamadasFeitas: 0,
    ordem: 0,
    anteriores: [],
  };
}

/** Texto legível de uma chamada, para a tela e para a etapa gravada. */
export function descreverChamada(nome: string, entrada: Record<string, unknown>): string {
  const consulta = typeof entrada.consulta === 'string' ? entrada.consulta.slice(0, 120) : '';
  switch (nome) {
    case 'buscar_memoria':
      return `Buscar na memória: "${consulta}"`;
    case 'buscar_web':
      return `Pesquisar na web: "${consulta}"`;
    case 'listar_agentes':
      return 'Ver os especialistas disponíveis';
    case 'consultar_agente':
      return 'Consultar um especialista';
    case 'abrir_pagina':
      return `Abrir a página: ${String(entrada.url ?? '').slice(0, 120)}`;
    case 'ler_emails':
      return 'Ler os e-mails recentes';
    case 'ler_agenda':
      return 'Ver a agenda';
    case 'buscar_drive':
      return `Procurar no Drive${entrada.busca ? `: "${String(entrada.busca).slice(0, 120)}"` : ''}`;
    case 'ler_arquivo_drive':
      return 'Ler um arquivo do Drive';
    case 'melhorar_texto':
      return 'Melhorar o texto';
    case 'gerar_ata':
      return 'Gerar a ata da reunião';
    case 'gerar_artigo':
      return `Escrever o artigo: "${String(entrada.tema ?? '').slice(0, 120)}"`;
    case 'salvar_no_repositorio':
      return `Salvar no Repositório: "${String(entrada.titulo ?? '').slice(0, 120)}"`;
    // Computador: rótulos curtos e sem caminhos completos (SR-40).
    case 'desktop_abrir_aplicativo':
      return `Abrir o aplicativo "${String(entrada.aplicativo ?? '').slice(0, 60)}"`;
    case 'desktop_fechar_aplicativo':
      return `Fechar o aplicativo "${String(entrada.aplicativo ?? '').slice(0, 60)}"`;
    case 'desktop_controlar_midia':
      return `Mídia: ${String(entrada.acao ?? '').replace('_', ' ')}`;
    case 'desktop_organizar_janelas':
      return `Organizar janelas (${String(entrada.layout ?? '').replace(/_/g, ' ')})`;
    case 'desktop_abrir_url':
      return 'Abrir um endereço no navegador';
    case 'desktop_abrir_documento':
      return 'Abrir um documento';
    case 'desktop_buscar_arquivos':
      return 'Procurar arquivos no computador';
    case 'desktop_energia':
      return `Energia: ${String(entrada.acao ?? '').replace('_', ' ')}`;
    case 'desktop_listar_processos':
    case 'desktop_listar_janelas':
    case 'desktop_listar_aplicativos':
      return 'Ver o que está aberto no computador';
    default:
      return `Executar ${nome}`;
  }
}

/**
 * Embrulha o resultado de uma ferramenta como DADO. O fechamento é
 * neutralizado dentro do conteúdo para uma nota ou página não conseguir
 * "sair" do bloco e se passar por instrução.
 */
export function embrulharResultado(nome: string, conteudo: string): string {
  const seguro = conteudo.replace(/<\/resultado>/gi, '</ resultado>');
  return `<resultado ferramenta="${nome}">\n${seguro}\n</resultado>`;
}

/** Roda `tarefas` com no máximo `limite` ao mesmo tempo, mantendo a ordem. */
export async function emParalelo<T>(
  tarefas: (() => Promise<T>)[],
  limite: number,
): Promise<T[]> {
  const saida = new Array<T>(tarefas.length);
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < tarefas.length) {
      const i = proxima++;
      saida[i] = await tarefas[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, tarefas.length) }, trabalhador));
  return saida;
}

function chaveFonte(f: Fonte): string {
  return typeof f === 'string' ? f.toLowerCase() : f.url;
}

const erro = (idChamada: string, conteudo: string): BlocoConversa => ({
  tipo: 'resultado',
  idChamada,
  conteudo,
  erro: true,
});

interface ExecucaoCtx {
  execucaoId: string;
  /** Texto original do usuário — o revisor compara cada escrita com ele. */
  pedido: string;
  ctx: ContextoFerramenta;
  plano: string;
  aoEtapa: (e: EtapaEvento) => void;
  limites: Limites;
  pode: Pode;
  aoCheckpoint?: AoCheckpoint;
  /**
   * Comando direto do usuário (caminho rápido): o turno 1 é esta chamada,
   * extraída de forma determinística do texto dele — o modelo não escolhe.
   * Passa pela mesma política/aprovação/gateway de qualquer chamada.
   */
  primeiraChamada?: ChamadaFerramenta;
}

/**
 * O loop "modelo → ferramentas → modelo". Cada turno é uma chamada com
 * ferramentas; as chamadas do mesmo turno rodam em paralelo (até a
 * concorrência), e cada uma vira uma etapa gravada, dependente das etapas
 * do turno anterior.
 *
 * Toda chamada passa pela política ANTES de rodar: sem permissão, o modelo
 * recebe um erro; escrita, o revisor de segurança dá um parecer (e pode
 * barrar) e a execução PAUSA com o estado salvo até o usuário aprovar ou
 * negar — e só então `retomar` continua de onde parou.
 */
@Injectable()
export class ExecutorService {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly registro: RegistroFerramentasService,
    private readonly auditoria: AuditoriaService,
    private readonly politica: PoliticaExecucaoService,
    private readonly revisor: RevisorSegurancaService,
  ) {}

  async executar(p: {
    execucaoId: string;
    pedido: string;
    ctx: ContextoFerramenta;
    plano: string;
    mensagens: MensagemComFerramentas[];
    aoEtapa: (e: EtapaEvento) => void;
    aoCheckpoint?: AoCheckpoint;
    limites?: Limites;
    primeiraChamada?: ChamadaFerramenta;
  }): Promise<ResultadoExecutor> {
    const exec = await this.contexto(p);
    exec.primeiraChamada = p.primeiraChamada;
    return this.loop(exec, estadoInicial(p.mensagens), { entrada: 0, saida: 0 });
  }

  /**
   * Continua uma execução pausada, com as decisões do usuário sobre TODAS as
   * aprovações pendentes do turno parado. Aprovadas rodam (com os parâmetros
   * aprovados, conferidos pelo hash); negadas e expiradas viram resultado de
   * erro para o modelo. Depois o loop segue normalmente.
   */
  async retomar(p: {
    execucaoId: string;
    pedido: string;
    ctx: ContextoFerramenta;
    plano: string;
    estado: EstadoExecutor;
    decisoes: Map<string, DecisaoGravada>;
    aoEtapa: (e: EtapaEvento) => void;
    aoCheckpoint?: AoCheckpoint;
    limites?: Limites;
  }): Promise<ResultadoExecutor> {
    // Permissões relidas: a role pode ter mudado durante a pausa.
    const exec = await this.contexto(p);
    const estado: EstadoExecutor = { ...p.estado, mensagens: [...p.estado.mensagens] };
    const pendente = estado.pendente;
    if (!pendente) throw new Error('Execução sem turno pendente para retomar.');

    const blocos = [...pendente.blocos];
    for (const a of pendente.aguardando) {
      blocos[a.indice] = await this.resolverAprovacao(exec, estado, a, p.decisoes.get(a.aprovacaoId));
    }
    estado.mensagens.push({
      papel: 'user',
      blocos: blocos.map((b, i) => b ?? erro(`?${i}`, 'Sem resultado.')),
    });
    estado.anteriores = [...pendente.etapasTurno].sort();
    estado.pendente = undefined;
    // Grava logo: se a API cair agora, a retomada não resolve as aprovações de novo.
    await exec.aoCheckpoint?.(estado, { entrada: 0, saida: 0 });
    return this.loop(exec, estado, { entrada: 0, saida: 0 });
  }

  /**
   * Continua do último checkpoint uma execução interrompida (queda da API).
   * O turno que estava em curso se perdeu junto com a resposta do modelo, então
   * o loop simplesmente pede o próximo turno a partir do histórico gravado.
   */
  async continuar(p: {
    execucaoId: string;
    pedido: string;
    ctx: ContextoFerramenta;
    plano: string;
    estado: EstadoExecutor;
    aoEtapa: (e: EtapaEvento) => void;
    aoCheckpoint?: AoCheckpoint;
    limites?: Limites;
  }): Promise<ResultadoExecutor> {
    const exec = await this.contexto(p);
    if (p.estado.pendente) throw new Error('Execução com aprovações pendentes: use retomar.');
    return this.loop(exec, { ...p.estado, mensagens: [...p.estado.mensagens] }, { entrada: 0, saida: 0 });
  }

  private async contexto(p: {
    execucaoId: string;
    pedido: string;
    ctx: ContextoFerramenta;
    plano: string;
    aoEtapa: (e: EtapaEvento) => void;
    aoCheckpoint?: AoCheckpoint;
    limites?: Limites;
  }): Promise<ExecucaoCtx> {
    return {
      execucaoId: p.execucaoId,
      pedido: p.pedido,
      ctx: p.ctx,
      plano: p.plano,
      aoEtapa: p.aoEtapa,
      aoCheckpoint: p.aoCheckpoint,
      limites: p.limites ?? LIMITES_PADRAO,
      pode: await this.politica.permissoesDe(p.ctx.user),
    };
  }

  private async resolverAprovacao(
    exec: ExecucaoCtx,
    estado: EstadoExecutor,
    a: AprovacaoPendente,
    d: DecisaoGravada | undefined,
  ): Promise<BlocoConversa> {
    const { ctx } = exec;
    const descricao = descreverChamada(a.ferramenta, a.entrada);
    const evento = (status: StatusEtapaEvento, err?: string) =>
      exec.aoEtapa({ chave: a.chave, ferramenta: a.ferramenta, descricao, status, ...(err ? { erro: err } : {}) });

    // Retomada após queda: a ação já tinha rodado — só devolve o resultado.
    if (d?.status === 'concluida') {
      estado.usadas = [...new Set([...estado.usadas, a.ferramenta])];
      return { tipo: 'resultado', idChamada: a.idChamada, conteudo: embrulharResultado(a.ferramenta, d.conteudo ?? '') };
    }
    // Caiu no meio da ação: não se sabe se aconteceu. Nunca repete.
    if (d?.status === 'interrompida') {
      const motivo =
        'A ação foi aprovada, mas o sistema caiu enquanto ela rodava: não é possível saber se ela aconteceu. ' +
        'Não tente de novo; peça ao usuário para conferir.';
      evento('falhou', motivo);
      return erro(a.idChamada, motivo);
    }
    if (!d || d.status !== 'aprovada') {
      const motivo =
        d?.status === 'expirada'
          ? 'A aprovação expirou e a ação NÃO foi executada. Diga isso ao usuário.'
          : `O USUÁRIO NEGOU esta ação, e ela NÃO foi executada. Diga ao usuário que não foi feita porque ele negou; não sugira falha técnica.${d?.motivo ? ` Motivo dele: ${d.motivo}` : ''}`;
      await this.prisma.etapaExecucao.updateMany({
        where: { id: a.etapaId, status: 'aguardando_aprovacao' },
        data: { status: 'negada', erro: motivo, concluidaEm: new Date() },
      });
      evento('negada', motivo);
      return erro(a.idChamada, motivo);
    }

    // O que roda é o que foi aprovado: a entrada gravada na aprovação tem de
    // bater com o hash gravado E com a chamada que pausou a execução.
    const hashAprovado = hashEntrada(d.entrada);
    if (hashAprovado !== d.hashEntrada || hashAprovado !== hashEntrada(a.entrada)) {
      const motivo = 'Os parâmetros não conferem com os aprovados; a ação não foi executada.';
      await this.falharEtapa(a.etapaId, motivo);
      await this.auditoria.registrar({
        empresaId: ctx.user.empresaId,
        usuarioId: ctx.user.id,
        execucaoId: exec.execucaoId,
        etapaId: a.etapaId,
        evento: 'acao.bloqueada',
        ferramenta: a.ferramenta,
        detalhes: { motivo: 'hash divergente' },
      });
      evento('falhou', motivo);
      return erro(a.idChamada, motivo);
    }

    // A permissão vale no momento de executar, não só no de pedir.
    const decisao = this.politica.avaliar(this.registro.perfil(a.ferramenta), exec.pode);
    if (decisao.tipo === 'negar') {
      await this.falharEtapa(a.etapaId, decisao.motivo);
      evento('falhou', decisao.motivo);
      return erro(a.idChamada, decisao.motivo);
    }

    // Reivindica a etapa: só quem a tira de `aguardando_aprovacao` executa.
    // Uma segunda retomada (clique duplo, duas abas) não repete a ação.
    const { count } = await this.prisma.etapaExecucao.updateMany({
      where: { id: a.etapaId, status: 'aguardando_aprovacao' },
      data: { status: 'executando', iniciadaEm: new Date(), tentativas: { increment: 1 } },
    });
    if (count === 0) return erro(a.idChamada, 'Esta ação já foi processada.');
    evento('executando');

    // Escrita: a auditoria vem ANTES do efeito e é obrigatória.
    try {
      await this.auditoria.registrarObrigatorio({
        empresaId: ctx.user.empresaId,
        usuarioId: ctx.user.id,
        execucaoId: exec.execucaoId,
        etapaId: a.etapaId,
        evento: 'acao.iniciada',
        ferramenta: a.ferramenta,
        risco: this.registro.perfil(a.ferramenta)?.risco ?? null,
        detalhes: { aprovacaoId: a.aprovacaoId, hashEntrada: hashAprovado },
      });
    } catch {
      const motivo = 'Não foi possível registrar a auditoria; a ação não foi executada.';
      await this.falharEtapa(a.etapaId, motivo);
      evento('falhou', motivo);
      return erro(a.idChamada, motivo);
    }

    // O contexto da execução (com a aprovação) só é montado aqui, pelo
    // executor — a ferramenta desktop o usa como prova no gateway (SR-07).
    const r = await this.registro.executar(a.ferramenta, d.entrada, {
      ...ctx,
      execucao: { id: exec.execucaoId, etapaId: a.etapaId, aprovacaoId: a.aprovacaoId },
    });
    await this.prisma.etapaExecucao.update({
      where: { id: a.etapaId },
      data: r.ok
        ? {
            status: 'concluida',
            saida: { conteudo: this.registro.redigirSaida(a.ferramenta, r.conteudo) } as Prisma.InputJsonValue,
            concluidaEm: new Date(),
          }
        : { status: 'falhou', erro: r.erro, concluidaEm: new Date() },
    });
    await this.auditoria.registrar({
      empresaId: ctx.user.empresaId,
      usuarioId: ctx.user.id,
      execucaoId: exec.execucaoId,
      etapaId: a.etapaId,
      evento: r.ok ? 'acao.executada' : 'acao.falhou',
      ferramenta: a.ferramenta,
      detalhes: r.ok ? { aprovacaoId: a.aprovacaoId } : { aprovacaoId: a.aprovacaoId, erro: r.erro },
    });
    evento(r.ok ? 'concluida' : 'falhou', r.ok ? undefined : r.erro);
    if (!r.ok) return erro(a.idChamada, r.erro);
    estado.usadas = [...new Set([...estado.usadas, a.ferramenta])];
    return { tipo: 'resultado', idChamada: a.idChamada, conteudo: embrulharResultado(a.ferramenta, r.conteudo) };
  }

  /** A chamada é a do caminho rápido (turno 1, primeira posição, mesma ferramenta)? */
  private ehDireto(exec: ExecucaoCtx, turno: number, indice: number): boolean {
    return !!exec.primeiraChamada && turno === 1 && indice === 0;
  }

  private async falharEtapa(etapaId: string, motivo: string): Promise<void> {
    await this.prisma.etapaExecucao.updateMany({
      where: { id: etapaId, status: { in: ['aguardando_aprovacao', 'executando'] } },
      data: { status: 'falhou', erro: motivo, concluidaEm: new Date() },
    });
  }

  private async loop(
    exec: ExecucaoCtx,
    estado: EstadoExecutor,
    usageChamada: LlmUsage,
  ): Promise<ResultadoExecutor> {
    const { ctx, limites } = exec;
    // Só são oferecidas as ferramentas que o usuário pode usar; a política
    // ainda confere cada chamada (o modelo pode pedir uma que não viu).
    const permitidas = this.registro
      .perfis()
      .filter((f) => exec.pode(f.permissao))
      // Conversa restrita ao repositório: nada de web nem de contas conectadas.
      .filter((f) => !(ctx.somenteRepositorio && f.dadosExternos))
      .map((f) => f.nome);
    const definicoes = this.registro.definicoes(permitidas);
    const fontes = new Map<string, Fonte>(estado.fontes);
    const usadas = new Set(estado.usadas);
    const fim = (resposta: string): ResultadoExecutor => ({
      tipo: 'resposta',
      resposta,
      fontes: [...fontes.values()].slice(0, 12),
      ferramentasUsadas: [...new Set([...usadas, ...estado.usadas])],
      usage: usageChamada,
      limiteAtingido: estado.limiteAtingido,
    });

    for (let turno = estado.turno + 1; ; turno++) {
      // Trava de segurança: com escolha "nenhuma" o modelo não chama
      // ferramentas, mas se insistir o loop não pode girar para sempre.
      if (turno > limites.maxTurnos + 1) {
        estado.limiteAtingido ??= 'turnos';
        return fim('Não consegui concluir a resposta dentro dos limites desta execução.');
      }
      if (!estado.limiteAtingido) {
        if (turno >= limites.maxTurnos) estado.limiteAtingido = 'turnos';
        else if (estado.chamadasFeitas >= limites.maxChamadas) estado.limiteAtingido = 'chamadas';
        else if (estado.usage.entrada + estado.usage.saida >= limites.orcamentoTokens) {
          estado.limiteAtingido = 'tokens';
        }
      }
      const direto = turno === 1 && estado.turno === 0 ? exec.primeiraChamada : undefined;
      const r = direto
        ? {
            texto: '',
            chamadas: [direto],
            parada: 'ferramenta' as const,
            usage: { entrada: 0, saida: 0 },
            mensagem: { papel: 'assistant' as const, blocos: [{ tipo: 'chamada' as const, ...direto }] },
          }
        : await this.ai.completarComFerramentas(ctx.user.empresaId, ctx.user.id, {
        system: systemExecutor(exec.plano),
        mensagens: estado.mensagens,
        // As definições vão sempre: o histórico pode ter chamadas antigas e
        // a Anthropic exige as ferramentas declaradas para lê-las.
        ferramentas: definicoes,
        // Com limite atingido, este turno só pode responder.
        escolha: estado.limiteAtingido ? 'nenhuma' : 'auto',
        maxTokens: limites.maxTokensTurno,
        fonte: 'orquestrador',
      });
      for (const u of [estado.usage, usageChamada]) {
        u.entrada += r.usage?.entrada ?? 0;
        u.saida += r.usage?.saida ?? 0;
      }
      estado.mensagens.push(r.mensagem);

      if (r.parada !== 'ferramenta' || r.chamadas.length === 0) {
        let resposta = r.texto.trim();
        if (r.parada === 'limite') resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
        return fim(resposta || 'Não consegui concluir a resposta.');
      }

      // Pediu ferramentas mesmo com limite atingido: nenhuma roda, e o
      // próximo turno responde.
      const cota = estado.limiteAtingido
        ? 0
        : Math.max(0, limites.maxChamadas - estado.chamadasFeitas);
      const etapasTurno: string[] = [];
      const aguardando: AprovacaoPendente[] = [];

      const tarefas = r.chamadas.map((c, i) => () =>
        this.processarChamada(exec, estado, c, i, turno, i < cota, etapasTurno, aguardando, fontes, usadas),
      );
      const blocos = await emParalelo(tarefas, limites.concorrencia);
      estado.chamadasFeitas += Math.min(r.chamadas.length, cota);
      estado.fontes = [...fontes];
      estado.usadas = [...usadas];

      if (aguardando.length) {
        estado.turno = turno;
        estado.pendente = {
          blocos,
          aguardando: aguardando.sort((a, b) => a.indice - b.indice),
          etapasTurno,
        };
        return { tipo: 'pausa', aprovacoes: estado.pendente.aguardando, estado, usage: usageChamada };
      }
      estado.anteriores = etapasTurno.sort();
      estado.mensagens.push({ papel: 'user', blocos: blocos as BlocoConversa[] });
      // Checkpoint: turno completo gravado. Uma queda daqui em diante retoma do próximo.
      estado.turno = turno;
      await exec.aoCheckpoint?.(estado, usageChamada);
    }
  }

  /** Uma chamada do turno. `null` = aguardando aprovação (vai para `aguardando`). */
  private async processarChamada(
    exec: ExecucaoCtx,
    estado: EstadoExecutor,
    c: ChamadaFerramenta,
    indice: number,
    turno: number,
    dentroDaCota: boolean,
    etapasTurno: string[],
    aguardando: AprovacaoPendente[],
    fontes: Map<string, Fonte>,
    usadas: Set<string>,
  ): Promise<BlocoConversa | null> {
    const { ctx } = exec;
    if (!dentroDaCota) {
      return erro(c.id, 'Limite de chamadas desta execução atingido. Responda com o que já tem.');
    }
    // Depois de uma retomada, o turno perdido na queda pode ter deixado etapas
    // com as mesmas chaves (`t2.1`…): o sufixo da retomada evita a colisão.
    const chave = `t${turno}.${indice + 1}${estado.retomadas ? `·r${estado.retomadas}` : ''}`;
    etapasTurno.push(chave);
    const descricao = descreverChamada(c.nome, c.entrada);
    const perfil = this.registro.perfil(c.nome);
    const estatica = c.argumentosInvalidos
      ? ({ tipo: 'negar', motivo: 'Argumentos em JSON inválido; refaça a chamada.' } as const)
      : ctx.somenteRepositorio && perfil?.dadosExternos
        ? ({ tipo: 'negar', motivo: MOTIVO_SOMENTE_REPOSITORIO } as const)
        : this.politica.avaliar(perfil, exec.pode);
    // Política dinâmica (ex.: desktop): depende da entrada e do estado da
    // execução. A estática continua mandando no "negar" (permissão).
    const dinamica =
      estatica.tipo === 'negar'
        ? null
        : await this.registro.avaliar(c.nome, c.entrada, {
            ...ctx,
            execucao: { id: exec.execucaoId, etapaId: '', ...(this.ehDireto(exec, turno, indice) ? { comandoDireto: true } : {}) },
          });
    const decisao: Decisao = dinamica
      ? dinamica.decisao === 'negar'
        ? { tipo: 'negar', motivo: dinamica.motivo ?? 'Ação bloqueada pela política.' }
        : { tipo: dinamica.decisao }
      : estatica;
    const riscoRotulo = dinamica?.risco ?? perfil?.risco ?? null;

    const etapa = await this.prisma.etapaExecucao.create({
      data: {
        execucaoId: exec.execucaoId,
        chave,
        ordem: ++estado.ordem,
        // A etapa do comando direto fica marcada no banco: é o que o gateway confere (SR-06d).
        tipo: this.ehDireto(exec, turno, indice) ? 'comando_direto' : 'ferramenta',
        ferramenta: c.nome,
        descricao,
        dependeDe: estado.anteriores,
        // SR-40: caminhos/URLs de ferramentas sensíveis ficam redigidos.
        entrada: this.registro.redigir(c.nome, c.entrada) as Prisma.InputJsonValue,
        status: decisao.tipo === 'aprovar' ? 'aguardando_aprovacao' : 'executando',
        tentativas: decisao.tipo === 'permitir' ? 1 : 0,
        iniciadaEm: decisao.tipo === 'permitir' ? new Date() : null,
      },
    });

    if (decisao.tipo === 'negar') {
      await this.prisma.etapaExecucao.update({
        where: { id: etapa.id },
        data: { status: 'falhou', erro: decisao.motivo, concluidaEm: new Date() },
      });
      await this.auditoria.registrar({
        empresaId: ctx.user.empresaId,
        usuarioId: ctx.user.id,
        execucaoId: exec.execucaoId,
        etapaId: etapa.id,
        evento: c.argumentosInvalidos ? 'ferramenta.falhou' : 'politica.bloqueou',
        ferramenta: c.nome,
        risco: riscoRotulo,
        detalhes: { motivo: decisao.motivo },
      });
      exec.aoEtapa({ chave, ferramenta: c.nome, descricao, status: 'falhou', erro: decisao.motivo });
      return erro(c.id, decisao.motivo);
    }

    if (decisao.tipo === 'aprovar') {
      const prep = this.registro.preparar(c.nome, c.entrada);
      if (!prep.ok) {
        await this.prisma.etapaExecucao.update({
          where: { id: etapa.id },
          data: { status: 'falhou', erro: prep.erro, concluidaEm: new Date() },
        });
        exec.aoEtapa({ chave, ferramenta: c.nome, descricao, status: 'falhou', erro: prep.erro });
        return erro(c.id, prep.erro);
      }
      // Revisor de segurança: lê a ação e o pedido original e dá um parecer.
      // Pode barrar (sinal claro de injeção/vazamento) ou alertar; nunca
      // dispensa a aprovação humana que vem a seguir.
      // Complemento da política dinâmica (ex.: caminho real do app, GA-09).
      const resumo = dinamica?.detalhe ? `${prep.resumo} — ${dinamica.detalhe}` : prep.resumo;
      const revisao = await this.revisor.revisarAcao(ctx.user, {
        pedido: exec.pedido,
        ferramenta: c.nome,
        // GB-08: o risco real da política dinâmica (ex.: "alto"), não o estático.
        risco: riscoRotulo ?? 'escrita_interna',
        resumo,
        entrada: prep.entrada,
        // Só turnos ANTERIORES: o modelo escreveu estes parâmetros antes de
        // ver o resultado das chamadas do turno atual, então elas não podem
        // tê-los influenciado (e, rodando em paralelo, nem terminaram).
        fontesDeDados: estado.usadas,
      });
      await this.auditoria.registrar({
        empresaId: ctx.user.empresaId,
        usuarioId: ctx.user.id,
        execucaoId: exec.execucaoId,
        etapaId: etapa.id,
        evento: revisao.recomendacao === 'bloquear' ? 'revisao.bloqueou' : 'revisao.parecer',
        ferramenta: c.nome,
        risco: riscoRotulo,
        detalhes: revisao as unknown as Prisma.InputJsonValue,
      });
      if (revisao.recomendacao === 'bloquear') {
        const motivo =
          `A revisão de segurança bloqueou esta ação: ${revisao.motivos.join(' ') || 'risco alto'} ` +
          'Ela não foi executada. Explique isso ao usuário e não tente de novo.';
        await this.prisma.etapaExecucao.update({
          where: { id: etapa.id },
          data: { status: 'falhou', erro: motivo, concluidaEm: new Date() },
        });
        exec.aoEtapa({ chave, ferramenta: c.nome, descricao, status: 'falhou', erro: motivo });
        return erro(c.id, motivo);
      }

      const expiraEm = new Date(Date.now() + (dinamica?.validadeAprovacaoMs ?? VALIDADE_APROVACAO_MS));
      const aprovacao = await this.prisma.aprovacaoAcao.create({
        data: {
          empresaId: ctx.user.empresaId,
          execucaoId: exec.execucaoId,
          etapaId: etapa.id,
          solicitanteId: ctx.user.id,
          ferramenta: c.nome,
          // GA-03: o risco da política dinâmica (ex.: "alto"), que o gateway compara.
          risco: dinamica?.risco ?? perfil?.risco ?? 'escrita_interna',
          resumo,
          entrada: prep.entrada as Prisma.InputJsonValue,
          hashEntrada: hashEntrada(prep.entrada),
          revisao: revisao as unknown as Prisma.InputJsonValue,
          expiraEm,
        },
      });
      await this.prisma.etapaExecucao.update({
        where: { id: etapa.id },
        data: {
          entrada: this.registro.redigir(c.nome, prep.entrada) as Prisma.InputJsonValue,
          chaveIdempotencia: `aprovacao:${aprovacao.id}`,
        },
      });
      await this.auditoria.registrar({
        empresaId: ctx.user.empresaId,
        usuarioId: ctx.user.id,
        execucaoId: exec.execucaoId,
        etapaId: etapa.id,
        evento: 'aprovacao.solicitada',
        ferramenta: c.nome,
        risco: riscoRotulo,
        // GB-05/SR-40: ferramentas com redação (desktop) não levam caminhos
        // completos para a auditoria; as demais mantêm o resumo legível.
        detalhes: (() => {
          const redigida = this.registro.redigir(c.nome, prep.entrada);
          return redigida !== prep.entrada
            ? { aprovacaoId: aprovacao.id, entrada: redigida }
            : { aprovacaoId: aprovacao.id, resumo };
        })() as Prisma.InputJsonValue,
      });
      aguardando.push({
        aprovacaoId: aprovacao.id,
        etapaId: etapa.id,
        chave,
        indice,
        idChamada: c.id,
        ferramenta: c.nome,
        entrada: prep.entrada,
        resumo,
        expiraEm: expiraEm.toISOString(),
        revisao,
      });
      exec.aoEtapa({ chave, ferramenta: c.nome, descricao, status: 'aguardando_aprovacao' });
      return null;
    }

    // Leitura permitida: roda agora.
    exec.aoEtapa({ chave, ferramenta: c.nome, descricao, status: 'executando' });
    const resultado = await this.registro.executar(c.nome, c.entrada, {
      ...ctx,
      execucao: { id: exec.execucaoId, etapaId: etapa.id, ...(this.ehDireto(exec, turno, indice) ? { comandoDireto: true } : {}) },
    });
    await this.prisma.etapaExecucao.update({
      where: { id: etapa.id },
      data: resultado.ok
        ? {
            status: 'concluida',
            saida: {
              conteudo: this.registro.redigirSaida(c.nome, resultado.conteudo),
              fontes: resultado.fontes,
            } as Prisma.InputJsonValue,
            concluidaEm: new Date(),
          }
        : { status: 'falhou', erro: resultado.erro, concluidaEm: new Date() },
    });
    await this.auditoria.registrar({
      empresaId: ctx.user.empresaId,
      usuarioId: ctx.user.id,
      execucaoId: exec.execucaoId,
      etapaId: etapa.id,
      evento: resultado.ok ? 'ferramenta.executada' : 'ferramenta.falhou',
      ferramenta: c.nome,
      risco: riscoRotulo,
      detalhes: {
        entrada: this.registro.redigir(c.nome, c.entrada),
        ...(resultado.ok ? {} : { erro: resultado.erro }),
      } as Prisma.InputJsonValue,
    });
    exec.aoEtapa({
      chave,
      ferramenta: c.nome,
      descricao,
      status: resultado.ok ? 'concluida' : 'falhou',
      ...(resultado.ok ? {} : { erro: resultado.erro }),
    });
    if (!resultado.ok) return erro(c.id, resultado.erro);
    usadas.add(c.nome);
    for (const f of resultado.fontes) fontes.set(chaveFonte(f), f);
    return { tipo: 'resultado', idChamada: c.id, conteudo: embrulharResultado(c.nome, resultado.conteudo) };
  }
}
