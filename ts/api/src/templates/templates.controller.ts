import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { AtualizarTemplateDto, CriarTemplateDto } from './dto/template.dto';
import { TemplatesService, type ArquivoRecebido } from './templates.service';

/**
 * O multer corta um pouco acima de 4 MB: até lá quem responde é o
 * processador, com a mensagem em português; acima disso a requisição nem
 * chegaria inteira à função serverless.
 */
const UPLOAD = FileInterceptor('arquivo', {
  limits: { fileSize: 4.5 * 1024 * 1024, files: 1 },
});

/**
 * Templates de apresentação — Configurações › Geral › Aparência › Templates.
 *
 * Mesmas regras de acesso das Marcas: leitura liberada ao tenant (o AI Studio
 * monta o seletor a partir dela), escrita com `configuracoes.gerenciar`.
 * `empresaId` sai sempre do token.
 */
@Controller('empresa/templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  /** GET /empresa/templates[?ativos=1] → lista sem o binário e sem a estrutura completa. */
  @Get()
  listar(@CurrentUser() user: AuthenticatedUser, @Query('ativos') ativos?: string) {
    return this.templates.listar(user.empresaId, {
      soAtivos: ativos === '1' || ativos === 'true',
    });
  }

  /** GET /empresa/templates/:id → com a estrutura completa. */
  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.templates.obter(user.empresaId, id);
  }

  /** GET /empresa/templates/:id/arquivo → o arquivo original. */
  @Get(':id/arquivo')
  async baixar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const { nome, mime, conteudo } = await this.templates.baixar(user.empresaId, id);
    return new StreamableFile(conteudo, {
      type: mime,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
      length: conteudo.length,
    });
  }

  /**
   * POST /empresa/templates/analisar (multipart: arquivo) → processa SEM
   * gravar. Alimenta o status e a prévia do formulário antes do "Salvar";
   * nada fica no banco se o usuário desistir.
   */
  @Post('analisar')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  @UseInterceptors(UPLOAD)
  analisar(@UploadedFile() arquivo: ArquivoRecebido | undefined) {
    return this.templates.analisar(arquivo);
  }

  /** POST /empresa/templates (multipart: arquivo + nome, descricao, contexto). */
  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  @UseInterceptors(UPLOAD)
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarTemplateDto,
    @UploadedFile() arquivo: ArquivoRecebido | undefined,
  ) {
    return this.templates.criar(user.empresaId, dto, arquivo);
  }

  /** PATCH /empresa/templates/:id → nome, descrição, contexto, ativo. */
  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarTemplateDto,
  ) {
    return this.templates.atualizar(user.empresaId, id, dto);
  }

  /** PUT /empresa/templates/:id/arquivo (multipart: arquivo) → reprocessa. */
  @Put(':id/arquivo')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  @UseInterceptors(UPLOAD)
  trocarArquivo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() arquivo: ArquivoRecebido | undefined,
  ) {
    return this.templates.trocarArquivo(user.empresaId, id, arquivo);
  }

  /** DELETE /empresa/templates/:id */
  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  @HttpCode(204)
  remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.templates.remover(user.empresaId, id);
  }
}
