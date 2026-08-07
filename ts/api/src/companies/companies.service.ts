import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Assinatura, Convite, Empresa, UserRole, Usuario } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BillingService } from '@/billing/billing.service';
import { AuthService } from '@/auth/auth.service';
import { TRIAL_DIAS } from '@/billing/pricing';
import { CadastroDto } from './dto/cadastro.dto';
import { RegistrarDto } from './dto/registrar.dto';

/** Usuário no formato do front (ts/demo .../companies/context.ts), sem senha. */
export type UsuarioPublico = Omit<Usuario, 'senhaHash'>;

function toUsuarioPublico(usuario: Usuario): UsuarioPublico {
  const { senhaHash: _senhaHash, ...rest } = usuario;
  return rest;
}

export interface CadastroResult {
  empresa: Empresa;
  usuario: UsuarioPublico;
  assinatura: Assinatura;
  authToken: string;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Cria empresa + usuário owner em trial e dispara a assinatura de trial.
   * Tudo numa transação: ou cria tudo, ou nada. Já retorna o JWT (auto-login).
   */
  async cadastrar(dto: CadastroDto): Promise<CadastroResult> {
    const email = dto.responsavel.email.trim().toLowerCase();

    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }

    const senhaHash = await bcrypt.hash(dto.responsavel.senha, 10);
    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DIAS);

    const { empresa, usuario, assinatura } = await this.prisma.$transaction(
      async (tx) => {
        const empresa = await tx.empresa.create({
          data: {
            tipoPessoa: dto.tipoPessoa,
            documento: dto.documento,
            razaoSocial: dto.razaoSocial,
            nomeFantasia: dto.nomeFantasia ?? null,
            setor: dto.setor ?? null,
            plano: dto.plano,
            ciclo: dto.ciclo,
            modulos: dto.modulos,
          },
        });

        const usuario = await tx.usuario.create({
          data: {
            empresaId: empresa.id,
            nome: dto.responsavel.nome,
            email,
            senhaHash,
            telefone: dto.responsavel.telefone,
            role: 'owner',
            trialStartsAt: now,
            trialEndsAt: trialEnds,
          },
        });

        const assinatura = await this.billing.criarTrial(
          {
            empresaId: empresa.id,
            plano: dto.plano,
            ciclo: dto.ciclo,
            modulos: dto.modulos,
            configuracoes: dto.configuracoes,
            usuarios: dto.usuarios,
            posicoes: dto.posicoes,
          },
          tx,
        );

        return { empresa, usuario, assinatura };
      },
    );

    return {
      empresa,
      usuario: toUsuarioPublico(usuario),
      assinatura,
      authToken: this.auth.signToken(usuario),
    };
  }

  /**
   * Cadastro mínimo: empresa PF + owner + trial do plano básico.
   * Usado pelo fluxo novo de contas (sem precificador/documento).
   */
  async registrar(dto: RegistrarDto): Promise<CadastroResult> {
    const workspace =
      dto.workspaceNome?.trim() || dto.nome.trim() || 'Meu workspace';

    return this.cadastrar({
      tipoPessoa: 'pf',
      // Placeholder: cobrança real ainda não entra neste fluxo.
      documento: '000.000.000-00',
      razaoSocial: workspace,
      nomeFantasia: workspace,
      plano: 'basico',
      ciclo: 'mensal',
      modulos: ['ia_pessoal'],
      configuracoes: [{ modulo: 'ia_pessoal', plano: 'basico', quantidade: 1 }],
      usuarios: 1,
      posicoes: 0,
      responsavel: {
        nome: dto.nome.trim(),
        email: dto.email.trim().toLowerCase(),
        telefone: '',
        senha: dto.senha,
      },
    });
  }

  async emailJaCadastrado(email: string): Promise<boolean> {
    const u = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    return !!u;
  }

  getEmpresa(id: string): Promise<Empresa | null> {
    return this.prisma.empresa.findUnique({ where: { id } });
  }

  convitesDaEmpresa(empresaId: string): Promise<Convite[]> {
    return this.prisma.convite.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  /** Cria convites para os e-mails informados (ignora duplicados). */
  async convidar(
    empresaId: string,
    emails: string[],
    role: UserRole = 'membro',
  ): Promise<Convite[]> {
    const limpos = Array.from(
      new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    );

    const criados: Convite[] = [];
    for (const email of limpos) {
      const convite = await this.prisma.convite.upsert({
        where: { empresaId_email: { empresaId, email } },
        create: { empresaId, email, role },
        update: {}, // já existe → mantém
      });
      criados.push(convite);
    }
    return criados;
  }

  async removerConvite(empresaId: string, conviteId: string): Promise<void> {
    await this.prisma.convite.deleteMany({
      where: { id: conviteId, empresaId },
    });
  }

  /** Marca o onboarding da empresa como concluído. */
  async concluirOnboarding(empresaId: string): Promise<Empresa> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: { onboardingConcluidoEm: new Date() },
    });
  }
}
