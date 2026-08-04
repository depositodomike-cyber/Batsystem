import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InsightsService, type InsightDto } from './insights.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface GerarInsightsBody {
  titulo?: string;
  conteudo?: string;
  origem?: string;
  memoriaId?: string;
}

@Controller('ai/insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  /** GET /ai/insights → insights da empresa (mais recentes primeiro). */
  @Get()
  async listar(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ insights: InsightDto[] }> {
    return { insights: await this.insights.list(user.empresaId) };
  }

  /**
   * POST /ai/insights/gerar { titulo, conteudo } → gera insights a partir do
   * material via IA e os PERSISTE. Retorna os insights criados.
   */
  @Post('gerar')
  async gerar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GerarInsightsBody,
  ): Promise<{ insights: InsightDto[] }> {
    const conteudo = (body.conteudo || '').trim();
    if (!conteudo) throw new BadRequestException('Envie o conteúdo do material.');
    const insights = await this.insights.gerarDeMaterial(user.empresaId, user.id, {
      titulo: (body.titulo || '').trim(),
      conteudo,
      origem: (body.origem || '').trim() || 'Manual',
      memoriaId: (body.memoriaId || '').trim() || undefined,
    });
    return { insights };
  }
}
