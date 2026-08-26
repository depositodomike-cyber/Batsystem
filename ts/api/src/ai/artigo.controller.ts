import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { buildArtigoUser, parseArtigo, SYSTEM_ARTIGO, type Artigo } from './artigo/prompts';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface ArtigoBody {
  tema?: string;
  contexto?: string;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Artigo | null;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class ArtigoController {
  private readonly logger = new Logger(ArtigoController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/artigo → gera (ou refina) um artigo em Markdown.
   * Body: { tema, contexto?, fontes?(['memoria']), referencia?, ajuste?, anterior? }.
   * Retorna { titulo, subtitulo, conteudo }.
   */
  @Post('artigo')
  async artigo(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: ArtigoBody,
  ): Promise<Artigo> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o tema do artigo.');

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

    // Títulos das notas do vault: alvos dos [[wikilinks]] do bloco "Conexões no
    // Vault". Buscados pelo tema/contexto para trazer os assuntos vizinhos.
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
      buildArtigoUser({
        tema,
        contexto: (body.contexto || '').trim(),
        referencia,
        ajuste: (body.ajuste || '').trim(),
        anterior: body.anterior ?? null,
        titulosVault,
      });

    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_ARTIGO, userPrompt, 6000);
    return parseArtigo(text, tema);
  }
}
