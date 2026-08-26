import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import {
  buildRoteiroUser,
  parseRoteiro,
  SYSTEM_ROTEIRO_BOOK,
  SYSTEM_ROTEIRO_SLIDES,
  type Formato,
  type Roteiro,
} from './apresentacao/prompts';
import { buildPptx } from './apresentacao/build-pptx';
import { buildBookHtml, buildSlidesHtml } from './apresentacao/build-html';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const FORMATOS: Formato[] = ['pptx', 'slides-html', 'book-html'];

interface RoteiroBody {
  tema?: string;
  formato?: string;
  nSlides?: number | string;
  publico?: string;
  objetivo?: string;
  tom?: string;
  idioma?: string;
  fontes?: string[];
  referencia?: string;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

interface GerarBody {
  formato?: string;
  roteiro?: Roteiro;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

function sanitizeFilename(s: string): string {
  return (s || 'apresentacao').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().slice(0, 60) || 'apresentacao';
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class ApresentacaoController {
  private readonly logger = new Logger(ApresentacaoController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/apresentacao/roteiro → etapa 1: roteiro editável (JSON).
   * Retorna { formato, roteiro }.
   */
  @Post('apresentacao/roteiro')
  async roteiro(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: RoteiroBody,
  ): Promise<{ formato: Formato; roteiro: Roteiro }> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o tema da apresentação.');
    const formato: Formato = FORMATOS.includes(body.formato as Formato)
      ? (body.formato as Formato)
      : 'pptx';
    const nSlides = Number(body.nSlides) || 0;

    // Referências: "memoria" (diretrizes ativas do tenant) + texto do cliente.
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
        `${tema}\n${(body.objetivo || '').trim()}`,
        40,
      );
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const isBook = formato === 'book-html';
    const system = isBook ? SYSTEM_ROTEIRO_BOOK : SYSTEM_ROTEIRO_SLIDES;
    const design = parseDesign(body.design);
    const userPrompt =
      designBrief(design) +
      buildRoteiroUser({
        tema,
        formato,
        nSlides,
        publico: (body.publico || '').trim(),
        objetivo: (body.objetivo || '').trim(),
        tom: (body.tom || '').trim(),
        idioma: (body.idioma || '').trim(),
        referencia,
        titulosVault,
      });

    const { text } = await this.ai.completar(user.empresaId, user.id, system, userPrompt, 8000);
    const roteiro = parseRoteiro(text, formato);
    return { formato, roteiro };
  }

  /**
   * POST /ai/apresentacao/gerar → etapa 2: gera o arquivo a partir do roteiro
   * editado. pptx → download binário; slides-html/book-html → { html }.
   */
  @Post('apresentacao/gerar')
  async gerar(@Body() body: GerarBody, @Res() res: Response): Promise<void> {
    const formato: Formato = FORMATOS.includes(body.formato as Formato)
      ? (body.formato as Formato)
      : 'pptx';
    const roteiro = body.roteiro;
    if (!roteiro || typeof roteiro !== 'object') {
      throw new BadRequestException('Roteiro ausente — gere o roteiro primeiro.');
    }
    // Marca escolhida no AI Studio — dá cores, fontes e logo ao arquivo gerado.
    const design = parseDesign(body.design);

    if (formato === 'book-html') {
      if (!Array.isArray(roteiro.capitulos) || !roteiro.capitulos.length) {
        throw new BadRequestException('Roteiro sem capítulos.');
      }
      res.json({ html: buildBookHtml(roteiro, design) });
      return;
    }

    if (!Array.isArray(roteiro.slides) || !roteiro.slides.length) {
      throw new BadRequestException('Roteiro sem slides.');
    }

    if (formato === 'slides-html') {
      res.json({ html: buildSlidesHtml(roteiro, design) });
      return;
    }

    // pptx → download binário.
    const buffer = await buildPptx(roteiro, design);
    const nome = sanitizeFilename(roteiro.titulo);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.pptx"`);
    res.send(buffer);
  }
}
