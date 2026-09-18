import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AiService } from './ai.service';
import {
  buildAjusteUser,
  buildIdentidadeUser,
  buildPlanoUser,
  buildRoteiroUser,
  buildSlidesDoPlanoUser,
  parseIdentidade,
  parsePlano,
  parsePlanoSlide,
  parseRoteiro,
  SYSTEM_AJUSTE,
  SYSTEM_CAPITULOS_DO_PLANO,
  SYSTEM_IDENTIDADE,
  SYSTEM_PLANO,
  SYSTEM_ROTEIRO_BOOK,
  SYSTEM_ROTEIRO_SLIDES,
  SYSTEM_SLIDES_DO_PLANO,
  type Formato,
  type IdentidadeExtraida,
  type Plano,
  type PlanoSlide,
  type Roteiro,
} from './apresentacao/prompts';
import { buildPptx } from './apresentacao/build-pptx';
// O mesmo extrator dos uploads de Análise, Ata e Documento: .pdf via pdf-parse,
// .docx via mammoth, texto puro direto. Nenhum ramo novo de formato.
import { extrairTexto } from './analise/extrair-texto';
import { buildBookHtml, buildSlidesHtml } from './apresentacao/build-html';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const FORMATOS: Formato[] = ['pptx', 'slides-html', 'book-html'];

// O multer (memoryStorage) entrega o arquivo com estes campos — mesma forma de
// analise.controller.ts.
interface ArquivoEnviado {
  originalname: string;
  buffer: Buffer;
  size: number;
}


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

/**
 * Proveniência da geração — o que de fato entrou no prompt.
 *
 * Existe para a tela poder relatar as fontes sem adivinhar. Repare na
 * assimetria, que é real: o conteúdo das MEMÓRIAS entra no prompt, enquanto do
 * vault só saem TÍTULOS, e apenas como alvos de [[wikilink]] no bloco de
 * conexões — nenhum arquivo .md é lido aqui.
 */
export interface FontesUsadas {
  /** Regras/definições ativas cujo conteúdo entrou em "## REFERÊNCIAS". */
  memorias: { id: string; title: string; category: string }[];
  /** Títulos oferecidos como alvo de [[wikilink]] — NÃO foram lidos. */
  vaultTitulos: string[];
  /** O bloco de referências passou de 20.000 caracteres e foi cortado. */
  truncado: boolean;
}

interface AjustarBody {
  plano?: Plano;
  /** Índice do slide no plano (base 0). */
  indice?: number | string;
  instrucao?: string;
  design?: DesignSystemDto;
}

interface SlidesBody {
  plano?: Plano;
  formato?: string;
  publico?: string;
  objetivo?: string;
  tom?: string;
  idioma?: string;
  design?: DesignSystemDto;
}

/**
 * Recorta o JSON da resposta do modelo (cercas ```json, preâmbulo, sufixo).
 * `parsePlanoSlide` recebe um objeto, não o texto cru — este é o adaptador.
 */
function extrairJson(raw: string): unknown {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf('{');
  const last = txt.lastIndexOf('}');
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
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
   * Retorna { formato, roteiro, fontesUsadas }.
   */
  @Post('apresentacao/roteiro')
  async roteiro(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: RoteiroBody,
  ): Promise<{
    formato: Formato;
    roteiro: Roteiro;
    fontesUsadas: FontesUsadas;
  }> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o tema da apresentação.');
    const formato: Formato = FORMATOS.includes(body.formato as Formato)
      ? (body.formato as Formato)
      : 'pptx';
    const nSlides = Number(body.nSlides) || 0;

    const { referencia, titulosVault, fontesUsadas } = await this.carregarFontes(
      user,
      repositorioId,
      body,
      tema,
    );

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
    return { formato, roteiro: parseRoteiro(text, formato), fontesUsadas };
  }

  /**
   * Referências do Repositório + títulos do Vault + o recibo do que foi usado.
   * Compartilhado por `/roteiro` e `/plano`: as duas entradas do fluxo partem
   * exatamente do mesmo contexto.
   */
  private async carregarFontes(
    user: AuthenticatedUser,
    repositorioId: string | null,
    body: RoteiroBody,
    tema: string,
  ): Promise<{
    referencia: string;
    titulosVault: string[];
    fontesUsadas: FontesUsadas;
  }> {
    let referencia = (body.referencia || '').trim();
    let memorias: FontesUsadas['memorias'] = [];
    if (Array.isArray(body.fontes) && body.fontes.includes('memoria')) {
      try {
        const itens = (await this.memorias.list(user.empresaId))
          .filter((m) => m.active)
          .slice(0, 60);
        memorias = itens.map((m) => ({
          id: m.id,
          title: m.title,
          category: m.category,
        }));
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

    return {
      referencia,
      titulosVault,
      fontesUsadas: {
        memorias,
        vaultTitulos: titulosVault,
        // Mesmo corte que `blocoVariaveis` aplica ao bloco de referências.
        truncado: referencia.length > 20000,
      },
    };
  }

  /**
   * POST /ai/apresentacao/plano → a IA projeta a apresentação.
   *
   * Primeira etapa do fluxo "planejar → gerar → consumir": devolve o que cada
   * slide vai FAZER, não o texto final. O usuário revisa, ajusta por instrução
   * e só então aprova a geração.
   */
  @Post('apresentacao/plano')
  async plano(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: RoteiroBody,
  ): Promise<{ formato: Formato; plano: Plano; fontesUsadas: FontesUsadas }> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o tema da apresentação.');
    const formato: Formato = FORMATOS.includes(body.formato as Formato)
      ? (body.formato as Formato)
      : 'pptx';

    const { referencia, titulosVault, fontesUsadas } = await this.carregarFontes(
      user,
      repositorioId,
      body,
      tema,
    );

    const design = parseDesign(body.design);
    const userPrompt =
      designBrief(design) +
      buildPlanoUser({
        tema,
        formato,
        nSlides: Number(body.nSlides) || 0,
        publico: (body.publico || '').trim(),
        objetivo: (body.objetivo || '').trim(),
        tom: (body.tom || '').trim(),
        idioma: (body.idioma || '').trim(),
        referencia,
        titulosVault,
      });

    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_PLANO,
      userPrompt,
      8000,
      'apresentacao-plano',
    );
    return { formato, plano: parsePlano(text), fontesUsadas };
  }

  /**
   * POST /ai/apresentacao/ajustar → reescreve UM slide do plano.
   *
   * Recebe o plano inteiro para a IA entender a progressão (uma instrução como
   * "faça virar transição" só faz sentido em relação aos vizinhos), mas devolve
   * apenas o slide pedido — quem preserva o resto é o cliente.
   */
  @Post('apresentacao/ajustar')
  async ajustar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AjustarBody,
  ): Promise<{ slide: PlanoSlide }> {
    const instrucao = (body.instrucao || '').trim();
    if (!instrucao) {
      throw new BadRequestException('Escreva o que você quer mudar neste slide.');
    }
    const plano = body.plano;
    const indice = Number(body.indice);
    if (
      !plano ||
      !Array.isArray(plano.slides) ||
      !Number.isInteger(indice) ||
      indice < 0 ||
      indice >= plano.slides.length
    ) {
      throw new BadRequestException('Slide não encontrado no plano.');
    }

    const design = parseDesign(body.design);
    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_AJUSTE,
      designBrief(design) + buildAjusteUser(plano, indice, instrucao),
      2000,
      'apresentacao-ajuste',
    );

    const atual = plano.slides[indice];
    const novo = parsePlanoSlide(extrairJson(text), indice);
    // O id é do cliente, não do modelo: se a IA trocar, o slide vira outro e a
    // reordenação/seleção da tela perde a referência.
    return { slide: { ...novo, id: atual.id } };
  }

  /**
   * POST /ai/apresentacao/slides → a IA executa o plano aprovado.
   *
   * Transforma a especificação em conteúdo final. O arquivo continua saindo do
   * `/gerar`, que é determinístico — aqui só se escreve o texto.
   */
  @Post('apresentacao/slides')
  async slides(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SlidesBody,
  ): Promise<{ formato: Formato; roteiro: Roteiro }> {
    const plano = body.plano;
    if (!plano || !Array.isArray(plano.slides) || !plano.slides.length) {
      throw new BadRequestException('Plano ausente — planeje a apresentação primeiro.');
    }
    const formato: Formato = FORMATOS.includes(body.formato as Formato)
      ? (body.formato as Formato)
      : 'pptx';
    const isBook = formato === 'book-html';

    const design = parseDesign(body.design);
    const userPrompt =
      designBrief(design) +
      buildSlidesDoPlanoUser(plano, {
        formato,
        nSlides: plano.slides.length,
        publico: (body.publico || '').trim(),
        objetivo: (body.objetivo || '').trim(),
        tom: (body.tom || '').trim(),
        idioma: (body.idioma || '').trim(),
      });

    const { text, truncated } = await this.ai.completar(
      user.empresaId,
      user.id,
      isBook ? SYSTEM_CAPITULOS_DO_PLANO : SYSTEM_SLIDES_DO_PLANO,
      userPrompt,
      12000,
      'apresentacao-slides',
    );
    if (truncated) {
      // Sem isto o JSON cortado morre no parse como "resposta inválida", e o
      // usuário não fica sabendo que o problema foi tamanho.
      throw new BadRequestException(
        'A apresentação ficou longa demais para uma resposta só. Reduza a quantidade de slides no plano e tente de novo.',
      );
    }
    const roteiro = parseRoteiro(text, formato);
    // As conexões pertencem ao plano (é lá que a IA as produziu); a execução
    // não precisa reescrevê-las.
    return { formato, roteiro: { ...roteiro, conexoes: plano.conexoes || roteiro.conexoes } };
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

  /**
   * POST /ai/apresentacao/identidade (multipart) → identidade visual extraída de
   * um manual de marca.
   *
   * Existe porque o arquivo gerado só obedece a hexadecimais: `designTheme()` lê
   * `cores.*` em #RRGGBB e ignora o resto. Mandar o manual inteiro como texto no
   * prompt faria a IA ESCREVER no espírito da marca, e o .pptx sairia com as
   * cores de sempre. Aqui o documento vira paleta, que é o que muda o pixel.
   *
   * Aditivo de ponta a ponta: não toca em `/plano`, `/ajustar`, `/slides` nem
   * `/gerar`. Aceita só o que `extrairTexto` já sabe ler (.pdf, .docx, texto) —
   * imagem não entra, porque nenhum provedor desta plataforma lê pixels.
   */
  @Post('apresentacao/identidade')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async identidade(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() arquivo: ArquivoEnviado | undefined,
  ): Promise<{ identidade: IdentidadeExtraida; origem: string }> {
    if (!arquivo) {
      throw new BadRequestException('Envie um arquivo com as especificações da marca.');
    }

    let texto = '';
    try {
      texto = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Não consegui ler o arquivo enviado.',
      );
    }
    if (!texto) {
      throw new BadRequestException(
        'Não consegui extrair texto do arquivo. Use um PDF com texto selecionável ou um .docx.',
      );
    }

    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_IDENTIDADE,
      buildIdentidadeUser(texto, arquivo.originalname),
      1500,
      'apresentacao-identidade',
    );

    const identidade = parseIdentidade(text);
    if (!identidade) {
      // Documento legível, mas sem identidade aproveitável. É informação, não
      // falha do servidor — 400 para o cliente poder dizer isso e seguir no
      // visual neutro, em vez de travar o fluxo.
      throw new BadRequestException(
        'Não encontrei especificações visuais neste documento. A apresentação segue no visual neutro.',
      );
    }

    return { identidade, origem: arquivo.originalname };
  }
}
