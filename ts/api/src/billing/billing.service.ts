import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Assinatura,
  CicloCobranca,
  MetodoPagamento,
  ModuloCode,
  PlanoCode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  calcularPreco,
  calcularPrecoPorModulo,
  MODULOS_FIXOS,
  TRIAL_DIAS,
  type ConfigModulo,
} from './pricing';

export interface CriarTrialInput {
  empresaId: string;
  plano: PlanoCode;
  ciclo: CicloCobranca;
  modulos: ModuloCode[];
  /** Plano e quantidade por módulo (modelo da calculadora). */
  configuracoes?: ConfigModulo[];
  usuarios: number;
  posicoes: number;
}

export interface AtivarAssinaturaInput {
  empresaId: string;
  plano: PlanoCode;
  ciclo: CicloCobranca;
  metodoPagamento: MetodoPagamento;
}

/**
 * Camada de cobrança. Mesma interface do front (ts/demo/src/services/billing).
 *
 * Hoje persiste no Postgres e SIMULA o checkout. A integração real com a Iugu
 * entra nos pontos marcados com `// TODO(iugu)` — sem mudar a interface pública.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Cria a assinatura em estado de trial (sem cobrança). */
  async criarTrial(
    input: CriarTrialInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Assinatura> {
    const db = tx ?? this.prisma;
    const now = new Date();
    const ends = new Date(now);
    ends.setDate(ends.getDate() + TRIAL_DIAS);

    // Modelo por módulo (calculadora) quando as configurações vierem; senão,
    // cálculo agregado legado (plano único).
    let usuarios: number;
    let posicoes: number;
    let precoUsuario = 0;
    let precoPosicao = 0;
    let total: number;
    let sobConsulta: boolean;

    if (input.configuracoes?.length) {
      const preco = calcularPrecoPorModulo(input.configuracoes, input.ciclo);
      const porUsuario = input.configuracoes.filter(
        (c) => c.modulo !== 'recrutamento',
      );
      const hiring = input.configuracoes.find(
        (c) => c.modulo === 'recrutamento',
      );
      usuarios = porUsuario.length
        ? Math.max(...porUsuario.map((c) => c.quantidade))
        : 0;
      posicoes = hiring?.quantidade ?? 0;
      // Snapshot unitário só faz sentido por módulo — fica em `configuracoes`.
      precoPosicao =
        preco.linhas.find((l) => l.modulo === 'recrutamento')?.unitario ?? 0;
      precoUsuario =
        preco.linhas.find((l) => !MODULOS_FIXOS.includes(l.modulo) && l.ancora)
          ?.unitario ?? 0;
      total = preco.total;
      sobConsulta = preco.sobConsulta;
    } else {
      const preco = calcularPreco({
        modulos: input.modulos,
        plano: input.plano,
        contrato: input.ciclo,
        usuarios: input.usuarios,
        posicoes: input.posicoes,
      });
      usuarios = preco.usuarios.quantidade;
      posicoes = preco.posicoes.quantidade;
      precoUsuario = preco.usuarios.unitario;
      precoPosicao = preco.posicoes.unitario;
      total = preco.total;
      sobConsulta = preco.sobConsulta;
    }

    // TODO(iugu): criar cliente + assinatura em trial na Iugu e guardar gatewayRef.

    return db.assinatura.create({
      data: {
        empresaId: input.empresaId,
        plano: input.plano,
        ciclo: input.ciclo,
        modulos: input.modulos,
        configuracoes: input.configuracoes
          ? (input.configuracoes as unknown as Prisma.InputJsonValue)
          : undefined,
        status: 'trial',
        usuarios,
        posicoes,
        precoUsuario,
        precoPosicao,
        total,
        sobConsulta,
        trialStartsAt: now,
        trialEndsAt: ends,
        ativadaEm: null,
        metodoPagamento: null,
        gatewayRef: null,
      },
    });
  }

  /** Retorna a assinatura da empresa, ou null. */
  async obterAssinatura(empresaId: string): Promise<Assinatura | null> {
    return this.prisma.assinatura.findUnique({ where: { empresaId } });
  }

  /** Ativa a assinatura (pronto p/ trocar o checkout simulado pela Iugu). */
  async ativarAssinatura(input: AtivarAssinaturaInput): Promise<Assinatura> {
    const existente = await this.prisma.assinatura.findUnique({
      where: { empresaId: input.empresaId },
    });
    if (!existente) {
      throw new NotFoundException('Assinatura não encontrada para esta empresa.');
    }

    const preco = calcularPreco({
      modulos: existente.modulos,
      plano: input.plano,
      contrato: input.ciclo,
      usuarios: existente.usuarios,
      posicoes: existente.posicoes,
    });

    // TODO(iugu): cobrar via método de pagamento e confirmar antes de ativar.

    return this.prisma.assinatura.update({
      where: { empresaId: input.empresaId },
      data: {
        plano: input.plano,
        ciclo: input.ciclo,
        status: 'ativa',
        precoUsuario: preco.usuarios.unitario,
        precoPosicao: preco.posicoes.unitario,
        total: preco.total,
        sobConsulta: preco.sobConsulta,
        ativadaEm: new Date(),
        metodoPagamento: input.metodoPagamento,
      },
    });
  }

  /** Cancela a assinatura. */
  async cancelar(empresaId: string): Promise<void> {
    const existente = await this.prisma.assinatura.findUnique({
      where: { empresaId },
    });
    if (!existente) return;
    // TODO(iugu): cancelar a assinatura no gateway.
    await this.prisma.assinatura.update({
      where: { empresaId },
      data: { status: 'cancelada' },
    });
  }
}
