import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { buildUserPrompt, SYSTEM_ANALISE } from './analise/framework';
import { extrairTexto, textoDeLink } from './analise/extrair-texto';
import { designBrief, parseDesign } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

// O multer (memoryStorage) entrega o arquivo com estes campos.
interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface AnaliseBody {
  link?: string;
  objetivo?: string;
  descricao?: string;
  vies?: string;
  fontes?: string; // JSON string: string[]
  secoes?: string; // JSON string: string[]
  referencia?: string; // texto de Notas/Insights/To-do's coletado no cliente
  design?: string; // JSON string: design system da marca (AI Studio)
}

function parseJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

@Controller('ai')
export class AnaliseController {
  private readonly logger = new Logger(AnaliseController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/analise (multipart) → análise de conteúdo em Markdown.
   * Campos: arquivo (opcional) OU link; objetivo (obrigatório); descricao; vies;
   * fontes (JSON string[]); secoes (JSON string[] de "1".."17"); referencia
   * (texto de Notas/Insights/To-do's coletado no cliente).
   * Retorna { titulo, analise, origem }.
   */
  @Post('analise')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async analise(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() arquivo: UploadedFileLike | undefined,
    @Body() body: AnaliseBody,
  ): Promise<{ titulo: string; analise: string; origem: string }> {
    const link = (body.link || '').trim();
    const objetivo = (body.objetivo || '').trim();
    const descricao = (body.descricao || '').trim();
    const vies = ['qualitativa', 'quantitativa', 'ambos'].includes(
      (body.vies || '').trim(),
    )
      ? (body.vies as string).trim()
      : 'ambos';
    const fontes = parseJsonArray(body.fontes);
    const secoes = parseJsonArray(body.secoes).filter((s) =>
      /^([1-9]|1[0-7])$/.test(s),
    );

    // Conteúdo: o arquivo tem prioridade; senão, o link.
    let conteudo = '';
    let origem = '';
    if (arquivo) {
      try {
        conteudo = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Não consegui ler o arquivo enviado.',
        );
      }
      origem = arquivo.originalname;
      if (!conteudo) {
        throw new BadRequestException('Não consegui extrair texto do arquivo enviado.');
      }
    } else if (link) {
      try {
        conteudo = await textoDeLink(link);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Não consegui ler o link informado.',
        );
      }
      origem = link;
      if (!conteudo) {
        throw new BadRequestException('O link não retornou texto para analisar.');
      }
    } else {
      throw new BadRequestException('Envie um arquivo ou informe um link para analisar.');
    }
    if (!objetivo) {
      throw new BadRequestException('Descreva o objetivo da análise.');
    }

    // Referências para cruzamento: "memoria" vem das diretrizes ativas do tenant;
    // Notas/Insights/To-do's chegam prontas do cliente (campo `referencia`).
    let referencia = '';
    if (fontes.includes('memoria')) {
      try {
        const itens = (await this.memorias.list(user.empresaId))
          .filter((m) => m.active)
          .slice(0, 60);
        if (itens.length) {
          referencia +=
            '### Memória (diretrizes ativas)\n' +
            itens.map((m) => `- ${m.title}: ${m.content}`).join('\n');
        }
      } catch (err) {
        this.logger.warn(`Falha ao carregar memórias para referência: ${String(err)}`);
      }
    }
    const refCliente = (body.referencia || '').trim();
    if (refCliente) referencia += (referencia ? '\n\n' : '') + refCliente;

    // Alvos dos [[wikilinks]] do bloco "Conexões no Vault": notas do vault
    // relacionadas ao objetivo/descrição e ao início do conteúdo analisado.
    let titulosVault: string[] = [];
    try {
      titulosVault = await this.vault.titulos(
        user.empresaId,
        `${objetivo}\n${descricao}\n${conteudo.slice(0, 600)}`,
        40,
      );
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const userPrompt =
      designBrief(parseDesign(body.design)) +
      buildUserPrompt({
        conteudo,
        objetivo,
        descricao,
        vies,
        referencia,
        secoes,
        titulosVault,
      });

    const { text, truncated } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_ANALISE,
      userPrompt,
      16000,
    );
    let analise = text.trim();
    if (truncated) {
      analise +=
        '\n\n---\n> ⚠️ **Análise truncada por tamanho.** O conteúdo é extenso e a resposta atingiu o limite. Analise um trecho menor ou peça o aprofundamento de uma seção específica.';
    }
    const titulo = (objetivo || 'Análise de conteúdo').slice(0, 80);
    return { titulo, analise, origem };
  }
}
