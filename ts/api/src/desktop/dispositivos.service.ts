import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type DispositivoDesktop } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { idDaRequisicao } from '@/common/correlacao';
import { chavePublicaDispositivo, impressaoDigital, sha256Hex, type Envelope } from './assinatura';
import { AGENTE_OFFLINE_MS, GatewayDesktopService } from './gateway.service';
import { paraEfetiva, PoliticaDesktopService } from './politica-desktop.service';

/** SR-23: 32 símbolos sem ambíguos (0/O, 1/I): 8 símbolos = 40 bits. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const VALIDADE_CODIGO_MS = 10 * 60_000;
const LONG_POLL_MS = 25_000;

export function gerarCodigo(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}
const hashCodigo = (c: string) => sha256Hex(`desktop-pareamento:${c.toUpperCase().replace(/[^A-Z0-9]/g, '')}`);

export const ESQUEMA_PAREAR = z
  .object({
    codigo: z.string().trim().min(8).max(12),
    chavePublica: z.string().min(80).max(400),
    nome: z.string().trim().min(1).max(80),
    versao: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .strict();

const ITEM_INVENTARIO = z
  .object({
    id: z.string().regex(/^[a-f0-9]{16,64}$/),
    nome: z.string().trim().min(1).max(120),
    alvo: z.string().max(400),
  })
  .strict();

export const ESQUEMA_SINCRONIZAR = z
  .object({
    versao: z.string().regex(/^\d+\.\d+\.\d+$/),
    estado: z.enum(['inicializando', 'sincronizando', 'atualizando', 'ativo', 'erro']),
    paradoLocal: z.boolean(),
    politicaAplicada: z.number().int().min(0),
    confirmacaoLocalPendente: z.boolean(),
    autoinicio: z.boolean(),
    inventario: z.array(ITEM_INVENTARIO).max(500).optional(),
    esperar: z.boolean().optional(),
  })
  .strict();

export const ESQUEMA_RESULTADO = z
  .object({
    comandoId: z.string().uuid(),
    ok: z.boolean(),
    verificado: z.boolean(),
    conteudo: z.string().max(20_000).optional(),
    erro: z.string().max(2000).optional(),
  })
  .strict();

/** Visão do dispositivo para a tela Ambiente local (sem chave). */
export function paraTela(d: DispositivoDesktop) {
  const online = !!d.ultimoContato && Date.now() - d.ultimoContato.getTime() <= AGENTE_OFFLINE_MS;
  let estado: string = d.status;
  if (d.status === 'conectado' && !online) estado = 'desconectado';
  if (d.paradoLocal) estado = 'bloqueado';
  return {
    id: d.id,
    nome: d.nome,
    estado,
    versaoAgente: d.versaoAgente,
    impressaoDigital: d.impressaoDigital,
    ultimoContato: d.ultimoContato,
    politicaAplicada: d.politicaAplicada,
    confirmacaoLocalPendente: d.confirmacaoLocalPendente,
    autoinicio: d.autoinicio,
    criadoEm: d.criadoEm,
    inventario: (d.inventario ?? []) as { id: string; nome: string; alvo: string }[],
  };
}

@Injectable()
export class DispositivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayDesktopService,
    private readonly politicas: PoliticaDesktopService,
  ) {}

  private async auditar(empresaId: string, usuarioId: string | null, evento: string, detalhes: Record<string, unknown>) {
    await this.prisma.registroAuditoria.create({
      data: {
        empresaId,
        usuarioId,
        evento,
        detalhes: detalhes as Prisma.InputJsonValue,
        idRequisicao: idDaRequisicao() ?? null,
      },
    });
  }

  // -------------------------------------------------------------- dono (JWT)

  async gerarCodigo(user: AuthenticatedUser) {
    // Um código ativo por vez.
    await this.prisma.pareamentoDesktop.deleteMany({ where: { empresaId: user.empresaId, usuarioId: user.id, usadoEm: null } });
    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + VALIDADE_CODIGO_MS);
    await this.prisma.pareamentoDesktop.create({
      data: { empresaId: user.empresaId, usuarioId: user.id, codigoHash: hashCodigo(codigo), expiraEm },
    });
    await this.auditar(user.empresaId, user.id, 'desktop.codigo.gerado', {});
    return {
      codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}`,
      expiraEm,
      impressaoServidor: this.gateway.chaveServidor().impressao,
    };
  }

  async listar(user: AuthenticatedUser) {
    const ds = await this.prisma.dispositivoDesktop.findMany({
      where: { empresaId: user.empresaId, usuarioId: user.id, status: { not: 'revogado' } },
      orderBy: { criadoEm: 'desc' },
    });
    return ds.map(paraTela);
  }

  private async meu(user: AuthenticatedUser, id: string) {
    const d = await this.prisma.dispositivoDesktop.findFirst({ where: { id, empresaId: user.empresaId, usuarioId: user.id } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado.');
    return d;
  }

  /** SR-28: o dono confere a impressão digital mostrada pelo agente. */
  async confirmar(user: AuthenticatedUser, id: string, impressao: string) {
    const d = await this.meu(user, id);
    if (d.status !== 'pendente') throw new ConflictException('Este dispositivo já foi confirmado.');
    const norm = (s: string) => s.toUpperCase().replace(/[^0-9A-F]/g, '');
    if (norm(impressao) !== norm(d.impressaoDigital)) {
      throw new BadRequestException('A impressão digital não confere com a do computador. Não confirme este dispositivo.');
    }
    await this.prisma.dispositivoDesktop.update({ where: { id }, data: { status: 'conectado', confirmadoEm: new Date() } });
    await this.auditar(user.empresaId, user.id, 'desktop.pareado', { dispositivoId: id, nome: d.nome });
    return { ok: true };
  }

  /** SR-32: apaga a chave; o agente recebe 401 e apaga a dele. */
  async revogar(user: AuthenticatedUser, id: string) {
    await this.meu(user, id);
    await this.prisma.$transaction([
      this.prisma.dispositivoDesktop.update({
        where: { id },
        data: { status: 'revogado', chavePublica: null, revogadoEm: new Date() },
      }),
      this.prisma.comandoDesktop.updateMany({
        where: { dispositivoId: id, status: { in: ['pendente', 'entregue'] } },
        data: { status: 'cancelado', erro: 'Dispositivo revogado.', concluidoEm: new Date() },
      }),
    ]);
    this.gateway.acordar(id);
    await this.auditar(user.empresaId, user.id, 'desktop.revogado', { dispositivoId: id });
    return { ok: true };
  }

  /**
   * SR-31: "Parar tudo". Bloqueia TODOS os computadores do usuário, cancela
   * comandos pendentes e nega as aprovações desktop pendentes.
   */
  async pararTudo(user: AuthenticatedUser) {
    const agora = new Date();
    const ds = await this.prisma.dispositivoDesktop.findMany({
      where: { empresaId: user.empresaId, usuarioId: user.id, status: { notIn: ['revogado', 'pendente'] } },
      select: { id: true },
    });
    const ids = ds.map((d) => d.id);
    // GB-08: execuções paradas esperando aprovação de ação no computador são
    // descartadas. As que estão rodando seguem, mas o gateway nega qualquer
    // nova operação (dispositivo bloqueado).
    const paradas = await this.prisma.aprovacaoAcao.findMany({
      where: { empresaId: user.empresaId, solicitanteId: user.id, status: 'pendente', ferramenta: { startsWith: 'desktop_' } },
      select: { execucaoId: true },
    });
    const execucoes = [...new Set(paradas.map((a) => a.execucaoId))];
    await this.prisma.$transaction([
      this.prisma.execucao.updateMany({
        where: { id: { in: execucoes }, usuarioId: user.id, status: 'aguardando_aprovacao' },
        data: { status: 'cancelada', estado: Prisma.DbNull, concluidaEm: agora, erro: 'Parar tudo.' },
      }),
      this.prisma.dispositivoDesktop.updateMany({ where: { id: { in: ids } }, data: { status: 'bloqueado' } }),
      this.prisma.comandoDesktop.updateMany({
        where: { dispositivoId: { in: ids }, status: { in: ['pendente', 'entregue'] } },
        data: { status: 'cancelado', erro: 'Parar tudo.', concluidoEm: agora },
      }),
      this.prisma.aprovacaoAcao.updateMany({
        where: { empresaId: user.empresaId, solicitanteId: user.id, status: 'pendente', ferramenta: { startsWith: 'desktop_' } },
        data: { status: 'negada', decididoPorId: user.id, decididoEm: agora, motivo: 'Parar tudo.' },
      }),
    ]);
    for (const id of ids) this.gateway.acordar(id);
    await this.auditar(user.empresaId, user.id, 'desktop.parada', { dispositivos: ids });
    return { ok: true, dispositivos: ids.length };
  }

  async retomar(user: AuthenticatedUser, id: string) {
    const d = await this.meu(user, id);
    if (d.status !== 'bloqueado') throw new ConflictException('Este dispositivo não está parado.');
    await this.prisma.dispositivoDesktop.update({ where: { id }, data: { status: 'conectado' } });
    await this.auditar(user.empresaId, user.id, 'desktop.retomado', { dispositivoId: id });
    return { ok: true };
  }

  async historico(user: AuthenticatedUser, limite = 50) {
    return this.prisma.registroAuditoria.findMany({
      where: { empresaId: user.empresaId, usuarioId: user.id, evento: { startsWith: 'desktop.' } },
      orderBy: { criadoEm: 'desc' },
      take: Math.min(Math.max(limite, 1), 200),
      select: { id: true, evento: true, ferramenta: true, risco: true, detalhes: true, criadoEm: true },
    });
  }

  // -------------------------------------------------------------- agente

  async parear(corpo: unknown) {
    const lido = ESQUEMA_PAREAR.safeParse(corpo);
    if (!lido.success) throw new BadRequestException('Pedido de pareamento inválido.');
    const { codigo, chavePublica, nome, versao } = lido.data;
    try {
      chavePublicaDispositivo(chavePublica);
    } catch {
      throw new BadRequestException('Chave pública inválida.');
    }
    const agora = new Date();
    const p = await this.prisma.pareamentoDesktop.findUnique({ where: { codigoHash: hashCodigo(codigo) } });
    // Mesma resposta para código inexistente, usado ou vencido.
    if (!p || p.usadoEm || p.expiraEm <= agora || p.tentativas >= 5) {
      if (p) await this.prisma.pareamentoDesktop.update({ where: { id: p.id }, data: { tentativas: { increment: 1 } } });
      throw new UnauthorizedException('Código de pareamento inválido ou expirado.');
    }
    const { count } = await this.prisma.pareamentoDesktop.updateMany({
      where: { id: p.id, usadoEm: null },
      data: { usadoEm: agora },
    });
    if (count !== 1) throw new UnauthorizedException('Código de pareamento inválido ou expirado.');
    const impressao = impressaoDigital(chavePublica);
    const d = await this.prisma.dispositivoDesktop.create({
      data: {
        empresaId: p.empresaId,
        usuarioId: p.usuarioId,
        nome,
        chavePublica,
        impressaoDigital: impressao,
        versaoAgente: versao,
        status: 'pendente',
        ultimoContato: agora,
      },
    });
    await this.auditar(p.empresaId, p.usuarioId, 'desktop.pareamento.solicitado', { dispositivoId: d.id, nome });
    const chave = this.gateway.chaveServidor();
    return {
      dispositivoId: d.id,
      chaveServidor: chave.publicaSpkiB64,
      impressaoServidor: chave.impressao,
      impressaoDispositivo: impressao,
    };
  }

  /**
   * Heartbeat + long-poll (o agente chama em loop; conexão sempre de saída).
   * Devolve o estado, a política assinada e os comandos a executar.
   */
  async sincronizar(d: DispositivoDesktop, corpo: unknown) {
    const lido = ESQUEMA_SINCRONIZAR.safeParse(corpo);
    if (!lido.success) throw new BadRequestException('Sincronização inválida.');
    const s = lido.data;
    const mapa = { inicializando: 'inicializando', sincronizando: 'sincronizando', atualizando: 'atualizando', erro: 'erro', ativo: 'conectado' } as const;
    // Bloqueado e pendente só mudam pelo dono.
    const status = d.status === 'bloqueado' || d.status === 'pendente' ? d.status : mapa[s.estado];
    const atual = await this.prisma.dispositivoDesktop.update({
      where: { id: d.id },
      data: {
        ultimoContato: new Date(),
        versaoAgente: s.versao,
        paradoLocal: s.paradoLocal,
        politicaAplicada: s.politicaAplicada,
        confirmacaoLocalPendente: s.confirmacaoLocalPendente,
        autoinicio: s.autoinicio,
        status,
        ...(s.inventario ? { inventario: s.inventario as Prisma.InputJsonValue } : {}),
      },
    });
    const pol = await this.politicas.obter(d.empresaId, d.usuarioId);
    // Autoinício é desejo do DONO (política); o agente só aplica após confirmar na bandeja.
    const envelopePolitica: Envelope = this.gateway.envelopePolitica(d.id, paraEfetiva(pol), pol.autoinicio);
    const podeExecutar = atual.status === 'conectado' && !s.paradoLocal;
    let comandos: Envelope[] = [];
    if (podeExecutar) {
      comandos = await this.gateway.entregarPendentes(d.id);
      if (!comandos.length && s.esperar) {
        await this.gateway.esperarComando(d.id, LONG_POLL_MS);
        const recarregado = await this.prisma.dispositivoDesktop.findUnique({ where: { id: d.id } });
        if (recarregado?.status === 'conectado') comandos = await this.gateway.entregarPendentes(d.id);
      }
    }
    const final = await this.prisma.dispositivoDesktop.findUnique({ where: { id: d.id }, select: { status: true } });
    return { estado: final?.status ?? 'revogado', politica: envelopePolitica, comandos };
  }

  async resultado(d: DispositivoDesktop, corpo: unknown) {
    const lido = ESQUEMA_RESULTADO.safeParse(corpo);
    if (!lido.success) throw new BadRequestException('Resultado inválido.');
    const r = lido.data;
    const agora = new Date();
    const c = await this.prisma.comandoDesktop.findFirst({ where: { id: r.comandoId, dispositivoId: d.id } });
    if (!c) throw new NotFoundException('Comando não encontrado.');
    const { count } = await this.prisma.comandoDesktop.updateMany({
      where: { id: c.id, dispositivoId: d.id, status: 'entregue' },
      data: r.ok
        ? { status: 'concluido', resultado: { conteudo: r.conteudo ?? '', verificado: r.verificado }, concluidoEm: agora }
        : { status: 'falhou', erro: r.erro ?? 'Falhou.', concluidoEm: agora },
    });
    if (count === 0) return { aceito: false };
    const disp = await this.prisma.dispositivoDesktop.findUnique({ where: { id: d.id }, select: { empresaId: true, usuarioId: true } });
    if (disp) {
      await this.prisma.registroAuditoria.create({
        data: {
          empresaId: disp.empresaId,
          usuarioId: disp.usuarioId,
          execucaoId: c.execucaoId,
          etapaId: c.etapaId,
          evento: r.ok ? 'desktop.comando.executado' : 'desktop.comando.falhou',
          ferramenta: `desktop_${c.operacao}`,
          risco: c.risco,
          detalhes: { comandoId: c.id, verificado: r.verificado, ...(r.ok ? {} : { erro: (r.erro ?? '').slice(0, 300) }) },
          idRequisicao: idDaRequisicao() ?? null,
        },
      });
    }
    return { aceito: true };
  }
}
