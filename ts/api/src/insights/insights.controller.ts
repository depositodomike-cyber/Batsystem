import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  InsightsService,
  type InsightDetalheDto,
  type InsightDto,
  type InsightFeedbackResumo,
} from './insights.service';
import { InsightFeedbackDto } from './dto/feedback.dto';
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
    return { insights: await this.insights.list(user.empresaId, user.id) };
  }

  /** PUT /ai/insights/:id/feedback { util, motivo?, comentario? } → 👍/👎. */
  @Put(':id/feedback')
  async salvarFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InsightFeedbackDto,
  ): Promise<{ feedback: InsightFeedbackResumo }> {
    return {
      feedback: await this.insights.salvarFeedback(
        user.empresaId,
        user.id,
        id,
        dto,
      ),
    };
  }

  /** DELETE /ai/insights/:id/feedback → desfaz o 👍/👎 do usuário. */
  @Delete(':id/feedback')
  @HttpCode(204)
  async removerFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.insights.removerFeedback(user.empresaId, user.id, id);
  }

  /** GET /ai/insights/nao-lidos → insights que o usuário ainda não viu (sino). */
  @Get('nao-lidos')
  async naoLidos(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ insights: InsightDto[]; total: number }> {
    return this.insights.listNaoLidos(user.empresaId, user.id);
  }

  /**
   * GET /ai/insights/:id → detalhe completo (modal "Ver insight"). Declarado
   * DEPOIS de `nao-lidos`: o Nest casa as rotas na ordem, e `:id` engoliria o
   * segmento estático.
   */
  @Get(':id')
  async detalhe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ insight: InsightDetalheDto }> {
    return {
      insight: await this.insights.detalhe(user.empresaId, user.id, id),
    };
  }

  /** POST /ai/insights/lidos → marca todos os não lidos do usuário como vistos. */
  @Post('lidos')
  @HttpCode(204)
  async marcarTodosLidos(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.insights.marcarTodosLidos(user.empresaId, user.id);
  }

  /** POST /ai/insights/:id/lido → marca um insight como visto pelo usuário. */
  @Post(':id/lido')
  @HttpCode(204)
  async marcarLido(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.insights.marcarLido(user.empresaId, user.id, id);
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
