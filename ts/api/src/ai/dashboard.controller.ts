import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import {
  buildDashboardUser,
  parseDashboard,
  SYSTEM_DASHBOARD,
  type Dashboard,
} from './dashboard/prompts';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface DashboardBody {
  tema?: string;
  dados?: string;
  contexto?: string;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Dashboard | null;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/dashboard → gera (ou refina) um dashboard como página HTML autônoma.
   * Body: { tema, dados?, contexto?, fontes?(['memoria']), referencia?, ajuste?, anterior? }.
   * Retorna { titulo, descricao, html }.
   */
  @Post('dashboard')
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: DashboardBody,
  ): Promise<Dashboard> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o objetivo do dashboard.');

    // Referência: "memoria" (diretrizes ativas do tenant) + texto do cliente.
    let referencia = (body.referencia || '').trim();
    if (Array.isArray(body.fontes) && body.fontes.includes('memoria')) {
      try {
        const itens = (await this.memorias.list(user.empresaId))
          .filter((m) => m.active)
          .slice(0, 60);
        if (itens.length) {
          const bloco =
            '### Memória (diretrizes ativas)\n' +
            itens.map((m) => `- ${m.title}: ${m.content}`).join('\n');
          referencia = referencia ? `${bloco}\n\n${referencia}` : bloco;
        }
      } catch (err) {
        this.logger.warn(`Falha ao carregar memórias: ${String(err)}`);
      }
    }

    // Alvos dos [[wikilinks]] do bloco "Conexões no Vault".
    let titulosVault: string[] = [];
    try {
      titulosVault = await this.vault.titulos(
        user.empresaId,
        repositorioId,
        `${tema}\n${(body.contexto || '').trim()}`,
        40,
      );
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const userPrompt =
      designBrief(parseDesign(body.design)) +
      buildDashboardUser({
        tema,
        dados: (body.dados || '').trim(),
        contexto: (body.contexto || '').trim(),
        referencia,
        ajuste: (body.ajuste || '').trim(),
        anterior: body.anterior ?? null,
        titulosVault,
      });

    // Dashboards são HTML — pedem mais tokens que um artigo.
    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_DASHBOARD,
      userPrompt,
      12000,
      'dashboard',
    );
    return parseDashboard(text, tema);
  }
}
