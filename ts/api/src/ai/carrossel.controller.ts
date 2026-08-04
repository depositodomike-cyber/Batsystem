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
  buildCarrosselUser,
  parseCarrossel,
  SYSTEM_CARROSSEL,
  type Carrossel,
} from './carrossel/prompts';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface CarrosselBody {
  tema?: string;
  contexto?: string;
  estilo?: string;
  nPaginas?: number | string;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Carrossel | null;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class CarrosselController {
  private readonly logger = new Logger(CarrosselController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/carrossel → gera (ou refina) o roteiro do carrossel.
   * Body: { tema, contexto?, estilo?, nPaginas?, fontes?, referencia?, ajuste?, anterior? }.
   * Retorna { titulo, cards, legenda, hashtags }.
   */
  @Post('carrossel')
  async carrossel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CarrosselBody,
  ): Promise<Carrossel> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o tema do carrossel.');

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
        `${tema}\n${(body.contexto || '').trim()}`,
        40,
      );
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const userPrompt =
      designBrief(parseDesign(body.design)) +
      buildCarrosselUser({
        tema,
        contexto: (body.contexto || '').trim(),
        estilo: (body.estilo || '').trim(),
        nPaginas: Number(body.nPaginas) || 0,
        referencia,
        ajuste: (body.ajuste || '').trim(),
        anterior: body.anterior ?? null,
        titulosVault,
      });

    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_CARROSSEL, userPrompt, 8000);
    return parseCarrossel(text, tema);
  }
}
