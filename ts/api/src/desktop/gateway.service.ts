import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type DispositivoDesktop } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { idDaRequisicao } from '@/common/correlacao';
import type { ContextoFerramenta } from '@/orquestrador/ferramentas/ferramenta';
import { ErroFerramenta } from '@/orquestrador/ferramentas/ferramenta';
import { hashEntrada } from '@/orquestrador/politica.service';
import { ChaveServidor, novoNonce, sha256Hex, type Envelope } from './assinatura';
import { estadoLiberacao, type EstadoLiberacao } from './liberacao';
import { paraEfetiva, PoliticaDesktopService } from './politica-desktop.service';
import {
  avaliarRisco,
  normalizarUrl,
  OPERACOES,
  redigirCaminho,
  riscoCobre,
  type Avaliacao,
  type Operacao,
} from './risco-desktop';

/** Validade de um comando entregue ao agente (SR-21). */
export const VALIDADE_COMANDO_MS = 60_000;
/** Quanto a ferramenta espera o resultado do agente (SR-33). */
export const TIMEOUT_RESULTADO_MS = 30_000;
/** Sem contato há mais que isto = agente offline (SR-30). */
export const AGENTE_OFFLINE_MS = 60_000;
/** SR-33. */
export const MAX_COMANDOS_MINUTO = 30;
/** Validade das aprovações de ferramentas desktop (SR-07). */
export const VALIDADE_APROVACAO_DESKTOP_MS = 10 * 60_000;
/** Versão mínima do agente aceita (SR-30). */
export const VERSAO_MINIMA_AGENTE = '1.0.0';

type Db = Prisma.TransactionClient | PrismaService;

export function versaoCompativel(v: string, minima = VERSAO_MINIMA_AGENTE): boolean {
  const a = v.split('.').map((x) => parseInt(x, 10));
  const b = minima.split('.').map((x) => parseInt(x, 10));
  if (a.length !== 3 || a.some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/** Parâmetros sem caminhos/URLs completos, para etapa e auditoria (SR-40). */
export function redigirParametros(entrada: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entrada)) {
    if (['caminho', 'origem', 'destino', 'diretorio'].includes(k)) out[k] = redigirCaminho(v, sha256Hex);
    else if (k === 'url') {
      const n = normalizarUrl(String(v));
      out[k] = n ? `${n.host} [#${sha256Hex(n.url).slice(0, 12)}]` : '[url inválida]';
    } else out[k] = v;
  }
  return out;
}

/**
 * Gateway desktop — ÚNICO caminho até o agente (SR-09a). Toda operação passa
 * por aqui, e aqui a autorização é refeita do zero, de forma determinística,
 * a partir do banco: dispositivo, política, contaminação da execução,
 * aprovação humana (para risco alto), limite de taxa. A auditoria obrigatória
 * e o comando nascem na MESMA transação (SR-09c). Qualquer falha nega
 * (SR-30).
 */
@Injectable()
export class GatewayDesktopService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GatewayDesktopService.name);
  private chave?: ChaveServidor;
  /** Pollers esperando comando, por dispositivo (só acorda: a verdade é o banco). */
  private readonly esperando = new Map<string, Set<() => void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly politicas: PoliticaDesktopService,
  ) {}

  liberacao(): EstadoLiberacao {
    return estadoLiberacao(this.config.get<string>('DESKTOP_ATIVO'), !!process.env.VERCEL);
  }

  chaveServidor(): ChaveServidor {
    this.chave ??= ChaveServidor.carregar(
      this.config.get<string>('DESKTOP_CHAVE_PRIVADA'),
      ChaveServidor.arquivoPadrao(),
    );
    return this.chave;
  }

  /** SR-29: comando pendente/entregue numa API que reiniciou nunca é reenviado. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const { count } = await this.prisma.comandoDesktop.updateMany({
        where: { status: { in: ['pendente', 'entregue'] } },
        data: { status: 'interrompido', erro: 'A API reiniciou antes do resultado.', concluidoEm: new Date() },
      });
      if (count) this.logger.warn(`${count} comando(s) desktop marcados como interrompidos.`);
      await this.prisma.nonceDesktop.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - 10 * 60_000) } } });
    } catch (err) {
      this.logger.error(`Falha na varredura de comandos desktop: ${String(err)}`);
    }
  }

  // ------------------------------------------------------------ autorização

  /**
   * Avaliação para o EXECUTOR decidir entre rodar, pedir aprovação ou negar.
   * Não envia nada. O `enviar` refaz tudo de novo no momento de executar.
   */
  async avaliar(
    op: Operacao,
    entrada: Record<string, unknown>,
    ctx: ContextoFerramenta & { execucao: { id: string; etapaId: string } },
  ): Promise<Avaliacao & { negado?: string }> {
    const lib = this.liberacao();
    if (!lib.ativo) return { risco: 'bloqueado', motivos: [lib.motivo ?? 'Indisponível.'], negado: lib.motivo };
    const disp = await this.dispositivoAtivo(this.prisma, ctx.user.empresaId, ctx.user.id);
    if ('erro' in disp) return { risco: 'bloqueado', motivos: [disp.erro], negado: disp.erro };
    const politica = paraEfetiva(await this.politicas.obter(ctx.user.empresaId, ctx.user.id));
    const contexto = await this.politicas.execucaoLimpa(this.prisma, ctx.execucao.id, ctx.execucao.etapaId);
    if (!contexto) return { risco: 'bloqueado', motivos: ['Execução não encontrada.'], negado: 'Execução não encontrada.' };
    return avaliarRisco(op, entrada, politica, contexto);
  }

  private async dispositivoAtivo(
    db: Db,
    empresaId: string,
    usuarioId: string,
  ): Promise<{ erro: string } | { dispositivo: DispositivoDesktop }> {
    const d = await db.dispositivoDesktop.findFirst({
      where: { empresaId, usuarioId, revogadoEm: null, chavePublica: { not: null }, status: { not: 'pendente' } },
      orderBy: { ultimoContato: { sort: 'desc', nulls: 'last' } },
    });
    if (!d) return { erro: 'Nenhum computador conectado ao Oracle. Conecte em Configurações > Ambiente local.' };
    if (d.status === 'bloqueado' || d.paradoLocal) {
      return { erro: 'O controle do computador está parado ("Parar tudo"). Retome em Configurações > Ambiente local ou na bandeja do agente.' };
    }
    if (d.status === 'revogado') return { erro: 'O computador foi desconectado do Oracle.' };
    if (!d.ultimoContato || Date.now() - d.ultimoContato.getTime() > AGENTE_OFFLINE_MS) {
      return { erro: 'O agente local do Oracle está offline neste computador.' };
    }
    if (!versaoCompativel(d.versaoAgente)) return { erro: `Agente local desatualizado (${d.versaoAgente}).` };
    return { dispositivo: d };
  }

  // ------------------------------------------------------------ envio

  /**
   * Autoriza, audita, enfileira e espera o resultado verificado.
   * `ferramenta` = nome no registro (para conferir a aprovação).
   */
  async enviar(
    ferramenta: string,
    op: Operacao,
    /** Entrada validada da ferramenta, como foi aprovada (o hash é dela). */
    entradaAprovada: Record<string, unknown>,
    /** Parâmetros resolvidos que vão ao agente (ex.: nome do app → id). */
    entrada: Record<string, unknown>,
    ctx: ContextoFerramenta,
    /**
     * GB-04: textos que o usuário VIU no pedido de aprovação e que amarram a
     * resolução (ex.: "Programa: C:\…\Figma.exe"). Numa operação de risco
     * alto, todos precisam estar no resumo aprovado — se o nome agora resolve
     * para outro programa, a aprovação não vale.
     */
    vinculo: string[] = [],
  ): Promise<string> {
    const lib = this.liberacao();
    if (!lib.ativo) throw new ErroFerramenta(`Controle do computador indisponível: ${lib.motivo}`);
    // SR-09a/SR-07: sem o contexto do executor não há execução, etapa nem prova.
    const exec = ctx.execucao;
    if (!exec) throw new ErroFerramenta('Operação desktop fora de uma execução do orquestrador.');
    const { user } = ctx;

    let comandoId: string;
    let dispositivoId: string;
    try {
      ({ comandoId, dispositivoId } = await this.prisma.$transaction(
        async (tx) => {
          const disp = await this.dispositivoAtivo(tx, user.empresaId, user.id);
          if ('erro' in disp) throw new ErroFerramenta(disp.erro);
          const d = disp.dispositivo;
          const politica = paraEfetiva(await this.politicas.obter(user.empresaId, user.id, tx));

          // Execução precisa ser do próprio usuário.
          const dono = await tx.execucao.findFirst({
            where: { id: exec.id, empresaId: user.empresaId, usuarioId: user.id },
            select: { id: true },
          });
          if (!dono) throw new ErroFerramenta('Execução não encontrada.');
          const contexto = await this.politicas.execucaoLimpa(tx, exec.id, exec.etapaId);
          if (!contexto) throw new ErroFerramenta('Execução não encontrada.');
          const av = avaliarRisco(op, entrada, politica, contexto);

          if (av.risco === 'bloqueado') {
            throw new ErroFerramenta(`Bloqueado pela política de segurança: ${av.motivos.join(' ')} Não tente de novo.`);
          }
          // SR-05/SR-07: risco alto só com aprovação humana válida, desta
          // execução/etapa/ferramenta, com o MESMO hash, ainda não consumida.
          if (av.risco === 'alto') {
            if (!exec.aprovacaoId) {
              throw new ErroFerramenta('Esta operação exige aprovação do usuário e não foi aprovada.');
            }
            const ap = await tx.aprovacaoAcao.findFirst({
              where: {
                id: exec.aprovacaoId,
                empresaId: user.empresaId,
                solicitanteId: user.id,
                execucaoId: exec.id,
                etapaId: exec.etapaId,
                ferramenta,
                status: 'aprovada',
                expiraEm: { gt: new Date() },
              },
            });
            if (
              !ap ||
              ap.hashEntrada !== hashEntrada(entradaAprovada) ||
              !riscoCobre(ap.risco, av.risco) ||
              !vinculo.every((v) => ap.resumo.includes(v))
            ) {
              throw new ErroFerramenta('A aprovação não confere com esta operação (parâmetros, risco ou validade). Nada foi executado.');
            }
          }
          // SR-33: limite de taxa por dispositivo.
          const recentes = await tx.comandoDesktop.count({
            where: { dispositivoId: d.id, emitidoEm: { gt: new Date(Date.now() - 60_000) } },
          });
          if (recentes >= MAX_COMANDOS_MINUTO) {
            throw new ErroFerramenta('Limite de operações por minuto atingido. Espere um pouco.');
          }

          const id = randomUUID();
          const nonce = novoNonce();
          const emitidoEm = new Date();
          const expiraEm = new Date(emitidoEm.getTime() + VALIDADE_COMANDO_MS);
          // SR-20/27: bytes assinados, amarrados ao dispositivo e ao tipo.
          const envelope: Envelope = this.chaveServidor().envelope({
            tipo: 'comando',
            dispositivoId: d.id,
            id,
            operacao: op,
            parametros: entrada,
            risco: av.risco,
            nonce,
            emitidoEm: emitidoEm.toISOString(),
            expiraEm: expiraEm.toISOString(),
            versaoPolitica: politica.versao,
          });
          // SR-09c/SR-40: auditoria obrigatória na MESMA transação do comando.
          await tx.registroAuditoria.create({
            data: {
              empresaId: user.empresaId,
              usuarioId: user.id,
              execucaoId: exec.id,
              etapaId: exec.etapaId,
              evento: 'desktop.comando.enviado',
              ferramenta,
              risco: av.risco,
              detalhes: {
                comandoId: id,
                dispositivoId: d.id,
                operacao: op,
                parametros: redigirParametros(entrada),
                motivos: av.motivos,
                ...(exec.aprovacaoId ? { aprovacaoId: exec.aprovacaoId } : {}),
              } as Prisma.InputJsonValue,
              idRequisicao: idDaRequisicao() ?? null,
            },
          });
          await tx.comandoDesktop.create({
            data: {
              id,
              dispositivoId: d.id,
              execucaoId: exec.id,
              etapaId: exec.etapaId,
              // @unique: a mesma aprovação não gera dois comandos (SR-07).
              aprovacaoId: av.risco === 'alto' ? exec.aprovacaoId : null,
              operacao: op,
              parametros: entrada as Prisma.InputJsonValue,
              risco: av.risco,
              nonce,
              envelope: envelope as unknown as Prisma.InputJsonValue,
              emitidoEm,
              expiraEm,
            },
          });
          return { comandoId: id, dispositivoId: d.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ));
    } catch (err) {
      if (err instanceof ErroFerramenta) {
        await this.auditar(user.empresaId, user.id, exec, 'desktop.comando.rejeitado', ferramenta, { operacao: op, motivo: err.message });
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ErroFerramenta('Esta aprovação já foi usada. Nada foi executado de novo.');
      }
      this.logger.error(`Falha ao enfileirar comando desktop: ${String(err)}`);
      throw new ErroFerramenta('Falha interna da camada de segurança: a operação não foi executada.');
    }

    this.acordar(dispositivoId);
    return this.aguardarResultado(comandoId, user.empresaId, user.id, exec, ferramenta);
  }

  private async aguardarResultado(
    comandoId: string,
    empresaId: string,
    usuarioId: string,
    exec: NonNullable<ContextoFerramenta['execucao']>,
    ferramenta: string,
  ): Promise<string> {
    const limite = Date.now() + TIMEOUT_RESULTADO_MS;
    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 400));
      const c = await this.prisma.comandoDesktop.findUnique({ where: { id: comandoId } });
      if (!c) break;
      if (c.status === 'concluido') {
        const r = (c.resultado ?? {}) as { conteudo?: unknown; verificado?: unknown };
        // "Não considerar concluída uma operação sem verificar seu resultado real."
        if (r.verificado !== true) {
          throw new ErroFerramenta('O agente executou, mas não conseguiu confirmar o resultado. Peça ao usuário para conferir; não repita.');
        }
        return typeof r.conteudo === 'string' ? r.conteudo : JSON.stringify(r.conteudo ?? 'ok');
      }
      if (c.status === 'falhou') throw new ErroFerramenta(`O computador recusou ou não conseguiu executar: ${c.erro ?? 'erro desconhecido'}`);
      if (c.status === 'cancelado' || c.status === 'interrompido') {
        throw new ErroFerramenta('A operação foi interrompida (parar tudo ou reinício). Não repita sem o usuário pedir.');
      }
    }
    // SR-29: estado desconhecido — nunca é reenviado.
    const { count } = await this.prisma.comandoDesktop.updateMany({
      where: { id: comandoId, status: { in: ['pendente', 'entregue'] } },
      data: { status: 'expirado', erro: 'Sem resultado no prazo.', concluidoEm: new Date() },
    });
    await this.auditar(empresaId, usuarioId, exec, 'desktop.comando.expirado', ferramenta, { comandoId });
    if (count === 0) return this.aguardarResultado(comandoId, empresaId, usuarioId, exec, ferramenta);
    throw new ErroFerramenta(
      'O agente não respondeu a tempo: não é possível saber se a operação aconteceu. Não repita; peça ao usuário para conferir.',
    );
  }

  private async auditar(
    empresaId: string,
    usuarioId: string,
    exec: ContextoFerramenta['execucao'],
    evento: string,
    ferramenta: string | null,
    detalhes: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.registroAuditoria.create({
        data: {
          empresaId,
          usuarioId,
          execucaoId: exec?.id ?? null,
          etapaId: exec?.etapaId ?? null,
          evento,
          ferramenta,
          detalhes: detalhes as Prisma.InputJsonValue,
          idRequisicao: idDaRequisicao() ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao auditar ${evento}: ${String(err)}`);
    }
  }

  // ------------------------------------------------------------ lado do agente

  acordar(dispositivoId: string): void {
    const s = this.esperando.get(dispositivoId);
    if (!s) return;
    this.esperando.delete(dispositivoId);
    for (const f of s) f();
  }

  /** Long-poll: espera até `ms` por um aviso de comando novo. */
  esperarComando(dispositivoId: string, ms: number): Promise<void> {
    return new Promise((resolve) => {
      let s = this.esperando.get(dispositivoId);
      if (!s) this.esperando.set(dispositivoId, (s = new Set()));
      const fim = () => {
        clearTimeout(t);
        s!.delete(fim);
        resolve();
      };
      const t = setTimeout(fim, ms);
      s.add(fim);
    });
  }

  /** Marca como entregues (uma única vez) os comandos válidos do dispositivo. */
  async entregarPendentes(dispositivoId: string): Promise<Envelope[]> {
    const agora = new Date();
    // Vencidos nunca são entregues (SR-29).
    await this.prisma.comandoDesktop.updateMany({
      where: { dispositivoId, status: 'pendente', expiraEm: { lte: agora } },
      data: { status: 'expirado', erro: 'Venceu antes de ser entregue.', concluidoEm: agora },
    });
    const pend = await this.prisma.comandoDesktop.findMany({
      where: { dispositivoId, status: 'pendente', expiraEm: { gt: agora } },
      orderBy: { emitidoEm: 'asc' },
      take: 5,
    });
    const out: Envelope[] = [];
    for (const c of pend) {
      const { count } = await this.prisma.comandoDesktop.updateMany({
        where: { id: c.id, status: 'pendente' },
        data: { status: 'entregue', entregueEm: agora },
      });
      if (count === 1) out.push(c.envelope as unknown as Envelope);
    }
    return out;
  }

  /** Política assinada para o agente (SR-27: tipo `politica`). */
  envelopePolitica(dispositivoId: string, p: ReturnType<typeof paraEfetiva>, autoinicio: boolean): Envelope {
    return this.chaveServidor().envelope({
      tipo: 'politica',
      dispositivoId,
      versao: p.versao,
      permissoes: p.permissoes,
      confirmar: p.confirmar,
      apps: p.apps,
      observaveis: p.observaveis,
      diretorios: p.diretorios,
      dominios: p.dominios,
      autoinicio,
      operacoes: Object.keys(OPERACOES),
    });
  }
}
