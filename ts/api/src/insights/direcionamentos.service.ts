import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstruturaStatus,
  type DirecionamentoPrioridade,
  type DirecionamentoTipo,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RolesService } from '@/acesso/roles.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import type {
  CreateDirecionamentoDto,
  UpdateDirecionamentoDto,
} from './dto/direcionamento.dto';

/** Forma retornada ao front (espelha `InsightDirecionamento` em ts/demo). */
export interface DirecionamentoDto {
  id: string;
  nome: string;
  tipo: DirecionamentoTipo;
  instrucao: string;
  /** Nulo = toda a organização. */
  area: { id: string; nome: string } | null;
  prioridade: DirecionamentoPrioridade;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/** O que o usuário pode escolher em "Onde observar?". */
export interface OpcoesFoco {
  podeTodaOrganizacao: boolean;
  areas: { id: string; nome: string }[];
}

/** Direcionamento ativo no formato que o prompt de insights consome. */
export interface DirecionamentoParaPrompt {
  id: string;
  nome: string;
  tipo: DirecionamentoTipo;
  instrucao: string;
  prioridade: DirecionamentoPrioridade;
  /** Nome da área, ou null para toda a organização. */
  area: string | null;
}

/** Teto de direcionamentos ativos enviados à IA por geração. */
const MAX_DIRECIONAMENTOS_NO_PROMPT = 30;

const INCLUDE_AREA = { area: { select: { id: true, nome: true } } } as const;

type Linha = {
  id: string;
  nome: string;
  tipo: DirecionamentoTipo;
  instrucao: string;
  prioridade: DirecionamentoPrioridade;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  area: { id: string; nome: string } | null;
};

function toDto(d: Linha): DirecionamentoDto {
  return {
    id: d.id,
    nome: d.nome,
    tipo: d.tipo,
    instrucao: d.instrucao,
    area: d.area,
    prioridade: d.prioridade,
    ativo: d.ativo,
    criadoEm: d.criadoEm.toISOString(),
    atualizadoEm: d.atualizadoEm.toISOString(),
  };
}

/**
 * "Direcionador de insights" — orientações da organização para a geração de
 * insights. Tudo é filtrado por `empresaId`; a permissão de escrita
 * (`insights.gerenciar_direcionadores`) é checada no controller pelo
 * `PermissoesGuard`. Aqui fica a regra de FOCO:
 *
 *   • administrador da conta (bypass owner/admin não-convidado, o mesmo do
 *     guard) escolhe toda a organização ou qualquer área ativa;
 *   • os demais só a PRÓPRIA área (`Membro.areaId`) — e só editam/excluem
 *     direcionamentos dessa área. Sem área, não há foco possível.
 */
@Injectable()
export class DirecionamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
  ) {}

  async list(empresaId: string): Promise<DirecionamentoDto[]> {
    const rows = await this.prisma.insightDirecionamento.findMany({
      where: { empresaId },
      orderBy: [{ ativo: 'desc' }, { criadoEm: 'desc' }],
      include: INCLUDE_AREA,
    });
    return rows.map(toDto);
  }

  /** Ativos, prioridade alta primeiro — o que entra no prompt de insights. */
  async ativosParaPrompt(
    empresaId: string,
  ): Promise<DirecionamentoParaPrompt[]> {
    const rows = await this.prisma.insightDirecionamento.findMany({
      where: { empresaId, ativo: true },
      // 'alta' > 'normal' na ordem do enum, então desc põe alta primeiro.
      orderBy: [{ prioridade: 'desc' }, { criadoEm: 'asc' }],
      take: MAX_DIRECIONAMENTOS_NO_PROMPT,
      include: INCLUDE_AREA,
    });
    return rows.map((d) => ({
      id: d.id,
      nome: d.nome,
      tipo: d.tipo,
      instrucao: d.instrucao,
      prioridade: d.prioridade,
      area: d.area?.nome ?? null,
    }));
  }

  async opcoesFoco(user: AuthenticatedUser): Promise<OpcoesFoco> {
    if (await this.ehAdminDaConta(user)) {
      const areas = await this.prisma.area.findMany({
        where: { empresaId: user.empresaId, status: EstruturaStatus.ativo },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      });
      return { podeTodaOrganizacao: true, areas };
    }
    const propria = await this.areaDoUsuario(user);
    return { podeTodaOrganizacao: false, areas: propria ? [propria] : [] };
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateDirecionamentoDto,
  ): Promise<DirecionamentoDto> {
    const areaId = await this.exigirFocoPermitido(user, dto.areaId ?? null);
    const row = await this.prisma.insightDirecionamento.create({
      data: {
        empresaId: user.empresaId,
        nome: this.exigirTexto(dto.nome, 'Informe um nome.'),
        tipo: dto.tipo,
        instrucao: this.exigirTexto(
          dto.instrucao,
          'Descreva o que a IA deve observar.',
        ),
        areaId,
        ...(dto.prioridade ? { prioridade: dto.prioridade } : {}),
        criadoPorId: user.id,
      },
      include: INCLUDE_AREA,
    });
    return toDto(row);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateDirecionamentoDto,
  ): Promise<DirecionamentoDto> {
    const atual = await this.exigirEditavel(user, id);
    const trocouArea = dto.areaId !== undefined && dto.areaId !== atual.areaId;
    const areaId = trocouArea
      ? await this.exigirFocoPermitido(user, dto.areaId ?? null)
      : undefined;

    const row = await this.prisma.insightDirecionamento.update({
      where: { id: atual.id },
      data: {
        ...(dto.nome !== undefined
          ? { nome: this.exigirTexto(dto.nome, 'Informe um nome.') }
          : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.instrucao !== undefined
          ? {
              instrucao: this.exigirTexto(
                dto.instrucao,
                'Descreva o que a IA deve observar.',
              ),
            }
          : {}),
        ...(trocouArea ? { areaId } : {}),
        ...(dto.prioridade !== undefined ? { prioridade: dto.prioridade } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
      include: INCLUDE_AREA,
    });
    return toDto(row);
  }

  /**
   * Exclui o direcionamento. Os insights gerados enquanto ele estava ativo
   * continuam existindo — a FK é `SetNull`, só o vínculo some.
   */
  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const atual = await this.exigirEditavel(user, id);
    await this.prisma.insightDirecionamento.delete({ where: { id: atual.id } });
  }

  // --------------------------------------------------------------------

  /** Mesmo critério do bypass do `PermissoesGuard`. */
  private async ehAdminDaConta(user: AuthenticatedUser): Promise<boolean> {
    if (user.role !== 'owner' && user.role !== 'admin') return false;
    const contexto = await this.roles.contextoDeAutorizacao(
      user.empresaId,
      user.id,
    );
    return !contexto.convidado;
  }

  /** Área ATIVA do membro vinculado ao usuário, se houver. */
  private async areaDoUsuario(
    user: AuthenticatedUser,
  ): Promise<{ id: string; nome: string } | null> {
    const membro = await this.prisma.membro.findUnique({
      where: {
        empresaId_usuarioId: { empresaId: user.empresaId, usuarioId: user.id },
      },
      select: {
        areaRef: { select: { id: true, nome: true, status: true } },
      },
    });
    const area = membro?.areaRef;
    if (!area || area.status !== EstruturaStatus.ativo) return null;
    return { id: area.id, nome: area.nome };
  }

  /**
   * Valida o foco escolhido e devolve o `areaId` a gravar. A área sempre é
   * conferida contra o tenant e o status — nunca se confia no id enviado.
   */
  private async exigirFocoPermitido(
    user: AuthenticatedUser,
    areaId: string | null,
  ): Promise<string | null> {
    if (await this.ehAdminDaConta(user)) {
      if (areaId === null) return null;
      const area = await this.prisma.area.findFirst({
        where: {
          id: areaId,
          empresaId: user.empresaId,
          status: EstruturaStatus.ativo,
        },
        select: { id: true },
      });
      if (!area) throw new BadRequestException('Área inválida ou inativa.');
      return area.id;
    }

    const propria = await this.areaDoUsuario(user);
    if (!propria) {
      throw new ForbiddenException(
        'Você não está vinculado a uma área ativa, então não pode criar orientações. Fale com um administrador da organização.',
      );
    }
    if (areaId !== propria.id) {
      throw new ForbiddenException(
        'Você só pode criar orientações para a sua própria área.',
      );
    }
    return propria.id;
  }

  /** Existe no tenant e, para não-admin, é da área do próprio usuário. */
  private async exigirEditavel(user: AuthenticatedUser, id: string) {
    const atual = await this.prisma.insightDirecionamento.findFirst({
      where: { id, empresaId: user.empresaId },
      select: { id: true, areaId: true },
    });
    if (!atual) throw new NotFoundException('Orientação não encontrada.');
    if (await this.ehAdminDaConta(user)) return atual;

    const propria = await this.areaDoUsuario(user);
    if (!propria || atual.areaId !== propria.id) {
      throw new ForbiddenException(
        'Você só pode alterar orientações da sua própria área.',
      );
    }
    return atual;
  }

  /** `@IsNotEmpty` valida a string bruta — "   " passaria sem isto. */
  private exigirTexto(valor: string, mensagem: string): string {
    const t = (valor ?? '').trim();
    if (!t) throw new BadRequestException(mensagem);
    return t;
  }
}
