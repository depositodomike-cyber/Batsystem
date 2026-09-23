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
  buildAjusteAbaUser,
  buildPlanoPlanilhaUser,
  parseAjusteAba,
  buildConteudoUser,
  parseConteudoPlanilha,
  parsePlanoPlanilha,
  SYSTEM_AJUSTE_ABA,
  SYSTEM_CONTEUDO_PLANILHA,
  SYSTEM_PLANO_PLANILHA,
  type ConteudoPlanilha,
  type PlanoAba,
  type PlanoPlanilha,
} from './planilha/prompts';
import { buildXlsx } from './planilha/build-xlsx';
// O mesmo extrator dos uploads de Análise, Ata, Documento e da identidade
// visual da apresentação: .pdf via pdf-parse, .docx via mammoth, texto puro
// direto — o que já cobre .csv. Nenhum ramo novo de formato.
import { extrairTexto } from './analise/extrair-texto';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

// ----------------------------------------------------------------------
// Criar planilha — etapa de PLANEJAMENTO.
//
// Segue o fluxo que `apresentacao.controller.ts` estabeleceu: a primeira
// chamada de IA devolve a especificação, não o arquivo. O usuário revisa aba a
// aba, dirige por instrução em português e só então aprova a geração (fase 2).
//
// Aditivo de ponta a ponta: nenhuma rota existente é tocada, e o único ponto de
// contato com o resto do backend são serviços de leitura que já existiam
// (MemoriasService, VaultService).
// ----------------------------------------------------------------------

// O multer (memoryStorage) entrega o arquivo com estes campos.
interface ArquivoEnviado {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface RecursosBody {
  formulas?: boolean;
  filtros?: boolean;
  validacoes?: boolean;
  formatacaoCondicional?: boolean;
}

// `notas` saiu dos três corpos: a tela não escolhe mais nota do Repositório, e
// a busca acontece no servidor. Um cliente antigo que ainda mande o campo tem
// ele descartado pelo ValidationPipe, sem quebrar.

interface PlanoBody {
  necessidade?: string;
  nome?: string;
  /** '' | 'resumido' | 'detalhado'. */
  detalhamento?: string;
  /** 0 = a IA decide. */
  nAbas?: number | string;
  recursos?: RecursosBody;
  /** Texto dos arquivos anexados, já extraído por `POST planilha/fonte`. */
  referencia?: string;
  /** Identidade visual escolhida no AI Studio. */
  design?: DesignSystemDto;
}

interface ConteudoBody {
  plano?: PlanoPlanilha;
  referencia?: string;
}

interface GerarBody {
  plano?: PlanoPlanilha;
  /**
   * As linhas já escritas pela IA.
   *
   * Vindo preenchido, a geração é só construção: nenhuma chamada ao modelo. É o
   * que permite a uma criação salva ser baixada de novo semanas depois, com o
   * arquivo idêntico e sem custo — o construtor é determinístico, então o mesmo
   * plano e o mesmo conteúdo dão os mesmos bytes.
   */
  conteudo?: ConteudoPlanilha;
  recursos?: RecursosBody;
  referencia?: string;
  design?: DesignSystemDto;
}

interface AjustarBody {
  plano?: PlanoPlanilha;
  /** Índice da aba no plano (base 0). */
  indice?: number | string;
  instrucao?: string;
  design?: DesignSystemDto;
}

/**
 * Proveniência do plano — o que de fato entrou no prompt.
 *
 * Existe para a tela poder relatar as fontes sem adivinhar, e para o §48 do
 * briefing: dado derivado de fonte não se mistura em silêncio com dado
 * inventado. `notas` traz só o que o usuário escolheu E o servidor autorizou —
 * um path recusado some daqui, que é como a tela descobre a recusa.
 */
export interface FontesPlanilha {
  memorias: { id: string; title: string; category: string }[];
  notas: { path: string; titulo: string }[];
  /** O bloco de referências passou de 20.000 caracteres e foi cortado. */
  truncado: boolean;
}

/**
 * Orçamento das notas que entram no prompt.
 *
 * Explícito, e não descoberto lá na frente: os construtores de prompt cortam em
 * 20.000, então sem um teto aqui o fim do bloco sumiria sem ninguém saber.
 */
const MAX_NOTAS = 5;
const MAX_POR_NOTA = 4_000;
const MAX_REFERENCIAS = 20_000;

const DETALHAMENTOS = ['', 'resumido', 'detalhado'] as const;
type Detalhamento = (typeof DETALHAMENTOS)[number];

/** Recursos com os padrões do §21: quem não abrir as avançadas recebe tudo. */
function parseRecursos(r: RecursosBody | undefined) {
  return {
    formulas: r?.formulas ?? true,
    filtros: r?.filtros ?? true,
    validacoes: r?.validacoes ?? true,
    formatacaoCondicional: r?.formatacaoCondicional ?? true,
  };
}

/**
 * O que procurar no Repositório na hora de PREENCHER a planilha.
 *
 * Título, objetivo e nomes de coluna — o vocabulário do que vai ser preenchido.
 * Diferente da etapa do plano, que procura pelo briefing: lá a pergunta é "que
 * estrutura isto pede?", aqui é "onde estão estes dados?".
 */
function consultaDoPlano(plano: PlanoPlanilha): string {
  const colunas = plano.abas
    .flatMap((a) => a.colunas.map((c) => c.nome))
    .slice(0, 40);
  return [plano.titulo, plano.objetivo, ...colunas]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1000);
}

/**
 * Nome de arquivo seguro para o header HTTP.
 *
 * ASCII puro de propósito: acento cru em `Content-Disposition` é inválido, e
 * quem nomeia o download bonito é a tela, que tem o título do plano em mãos.
 */
function nomeDeArquivo(titulo: string): string {
  const base = (titulo || 'planilha')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\-_ ]/g, '')
    .trim()
    .slice(0, 60);
  return base || 'planilha';
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class PlanilhaController {
  private readonly logger = new Logger(PlanilhaController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * Referências do Repositório + diretrizes ativas + o recibo do que foi usado.
   *
   * O Repositório entra SOZINHO: a tela não escolhe nota nenhuma, e a busca
   * acontece aqui, a partir do que a pessoa descreveu. É o mesmo que "Criar
   * apresentação" já faz — pedir a escolha era pedir uma decisão que o briefing
   * já tomou.
   *
   * A autorização continua na camada de dados: `VaultService.search` leva
   * `empresaId` e `repositorioId` no próprio SQL, então nota de outra
   * organização (ou de outro repositório da mesma) não tem por onde entrar.
   *
   * `semFallback` é deliberado: sem casamento, o padrão de `search` devolve as
   * notas mais RECENTES, e aqui elas virariam dado de planilha. Nenhuma nota é
   * melhor que nota errada.
   */
  private async carregarFontes(
    user: AuthenticatedUser,
    repositorioId: string | null,
    // Estrutural: `/plano`, `/conteudo` e `/gerar` montam o material da mesma
    // forma — o arquivo precisa ser construído a partir do que o plano viu.
    body: { referencia?: string },
    /** O que procurar no Repositório. Vazio = não procura. */
    consulta = '',
  ): Promise<{ referencia: string; fontes: FontesPlanilha }> {
    const blocos: string[] = [];

    let memorias: FontesPlanilha['memorias'] = [];
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
        blocos.push(
          '### Memória (diretrizes ativas)\n' +
            itens.map((m) => `- ${m.title}: ${m.content}`).join('\n'),
        );
      }
    } catch (err) {
      this.logger.warn(`Falha ao carregar memórias: ${String(err)}`);
    }

    let notas: FontesPlanilha['notas'] = [];
    if (consulta.trim()) {
      try {
        const hits = await this.vault.search(
          user.empresaId,
          repositorioId,
          consulta,
          MAX_NOTAS,
          { semFallback: true },
        );
        notas = hits.map((h) => ({ path: h.path, titulo: h.titulo }));
        for (const h of hits) {
          blocos.push(
            `### ${h.titulo} (Repositório)\n${h.conteudo.slice(0, MAX_POR_NOTA)}`,
          );
        }
      } catch (err) {
        // O Repositório é um plus: falha aqui não derruba a geração, ela só
        // acontece sem as notas.
        this.logger.warn(
          `Falha ao buscar notas do Repositório: ${String(err)}`,
        );
      }
    }

    // Texto dos uploads — já extraído por `POST planilha/fonte`, com o nome do
    // arquivo no cabeçalho de cada bloco (é assim que a IA sabe dizer, em
    // `fontes`, de onde cada aba veio).
    const anexado = (body.referencia || '').trim();
    if (anexado) blocos.push(anexado);

    const inteiro = blocos.join('\n\n');
    const referencia = inteiro.slice(0, MAX_REFERENCIAS);
    return {
      referencia,
      fontes: {
        memorias,
        notas,
        truncado: inteiro.length > MAX_REFERENCIAS,
      },
    };
  }

  /**
   * POST /ai/planilha/plano → a IA projeta a planilha.
   *
   * Devolve o que cada aba vai FAZER — colunas, cálculos, dependências — e não
   * o arquivo. O usuário revisa, ajusta por instrução e só então aprova.
   */
  @Post('planilha/plano')
  async plano(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: PlanoBody,
  ): Promise<{ plano: PlanoPlanilha; fontes: FontesPlanilha }> {
    const necessidade = (body.necessidade || '').trim();
    if (!necessidade) {
      throw new BadRequestException('Descreva o que você quer criar.');
    }

    // A consulta ao Repositório é o próprio briefing: é o que descreve o que a
    // planilha precisa, e portanto o que as notas relevantes falam.
    const { referencia, fontes } = await this.carregarFontes(
      user,
      repositorioId,
      body,
      necessidade,
    );

    const detalhamento = (
      DETALHAMENTOS as readonly string[]
    ).includes(body.detalhamento ?? '')
      ? ((body.detalhamento ?? '') as Detalhamento)
      : '';

    const design = parseDesign(body.design);
    const userPrompt =
      designBrief(design) +
      buildPlanoPlanilhaUser({
        necessidade,
        nome: (body.nome || '').trim(),
        detalhamento,
        nAbas: Number(body.nAbas) || 0,
        recursos: parseRecursos(body.recursos),
        referencia,
        // Diretriz da Memória é contexto, não dado: só nota e upload fazem a IA
        // poder preencher célula. É esta linha que decide entre "planilha
        // estruturada e vazia" e "planilha com os dados da fonte".
        temFontes: Boolean(fontes.notas.length || (body.referencia || '').trim()),
      });

    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_PLANO_PLANILHA,
      userPrompt,
      8000,
      'planilha-plano',
    );
    return { plano: parsePlanoPlanilha(text), fontes };
  }

  /**
   * POST /ai/planilha/ajustar → reescreve UMA aba do plano.
   *
   * Recebe o plano inteiro para a IA enxergar as dependências (uma instrução
   * como "adicione margem percentual" só faz sentido em relação à base), mas
   * devolve apenas a aba pedida — quem preserva o resto é o cliente. Os
   * `impactos` são declarados, não aplicados: mudar outra aba é decisão do
   * usuário.
   */
  @Post('planilha/ajustar')
  async ajustar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AjustarBody,
  ): Promise<{ aba: PlanoAba; impactos: string[] }> {
    const instrucao = (body.instrucao || '').trim();
    if (!instrucao) {
      throw new BadRequestException('Escreva o que você quer mudar nesta aba.');
    }
    const plano = body.plano;
    if (!plano || !Array.isArray(plano.abas) || !plano.abas.length) {
      throw new BadRequestException('Plano ausente — gere o plano primeiro.');
    }
    const indice = Number(body.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= plano.abas.length) {
      throw new BadRequestException('Aba inexistente no plano.');
    }

    const design = parseDesign(body.design);
    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_AJUSTE_ABA,
      designBrief(design) + buildAjusteAbaUser(plano, indice, instrucao),
      4000,
      'planilha-ajustar',
    );

    const { aba, impactos } = parseAjusteAba(text, indice);
    // O id é do cliente, não do modelo: ele identifica o card na tela e
    // sobrevive à reordenação. Devolver outro trocaria a aba de lugar.
    return { aba: { ...aba, id: plano.abas[indice].id }, impactos };
  }

  /**
   * POST /ai/planilha/conteudo → a IA preenche as linhas do plano aprovado.
   *
   * Separado de `/gerar` porque o resultado precisa VOLTAR para o cliente: é
   * ele que a criação guarda, e é com ele que o arquivo é remontado depois sem
   * gastar IA de novo. Uma resposta binária não teria onde carregar isso.
   */
  @Post('planilha/conteudo')
  async conteudo(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: ConteudoBody,
  ): Promise<{ conteudo: ConteudoPlanilha }> {
    const plano = body.plano;
    if (!plano || !Array.isArray(plano.abas) || !plano.abas.length) {
      throw new BadRequestException('Plano ausente — gere o plano primeiro.');
    }

    const { referencia } = await this.carregarFontes(
      user,
      repositorioId,
      body,
      consultaDoPlano(plano),
    );

    const { text } = await this.ai.completar(
      user.empresaId,
      user.id,
      SYSTEM_CONTEUDO_PLANILHA,
      buildConteudoUser(plano, referencia),
      12000,
      'planilha-conteudo',
    );

    // Não lança: aba que o modelo esqueceu sai vazia, e o arquivo é entregue
    // com a estrutura de qualquer jeito.
    return { conteudo: parseConteudoPlanilha(text, plano) };
  }

  /**
   * POST /ai/planilha/gerar → o plano aprovado vira arquivo.
   *
   * Com `conteudo` no corpo, é só construção — nenhuma chamada ao modelo. Sem
   * ele, a IA preenche as linhas aqui mesmo, que é como a rota nasceu e como
   * ela segue funcionando para quem a chamar assim.
   *
   * A fronteira que importa é a mesma nos dois caminhos: nenhuma fórmula
   * escrita pelo modelo entra no arquivo sem passar pela validação de
   * `build-xlsx`.
   */
  @Post('planilha/gerar')
  async gerar(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: GerarBody,
    @Res() res: Response,
  ): Promise<void> {
    const plano = body.plano;
    if (!plano || !Array.isArray(plano.abas) || !plano.abas.length) {
      throw new BadRequestException('Plano ausente — gere o plano primeiro.');
    }

    let conteudo = body.conteudo;
    if (!conteudo) {
      const { referencia } = await this.carregarFontes(
        user,
        repositorioId,
        body,
        consultaDoPlano(plano),
      );
      const { text } = await this.ai.completar(
        user.empresaId,
        user.id,
        SYSTEM_CONTEUDO_PLANILHA,
        buildConteudoUser(plano, referencia),
        12000,
        'planilha-conteudo',
      );
      // `parseConteudoPlanilha` não lança: aba que o modelo esqueceu sai vazia,
      // e o arquivo é entregue com a estrutura de qualquer jeito. Planilha
      // estruturada e sem linha é resultado legítimo; erro de geração, não.
      conteudo = parseConteudoPlanilha(text, plano);
    }

    const buffer = await buildXlsx(
      plano,
      conteudo,
      parseDesign(body.design),
      parseRecursos(body.recursos),
    );

    const nome = nomeDeArquivo(plano.titulo);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.xlsx"`);
    res.send(buffer);
  }

  /**
   * POST /ai/planilha/fonte (multipart) → texto de um arquivo anexado.
   *
   * Só extrai; não chama IA. A tela guarda o texto e o devolve em `referencia`
   * na hora de planejar, o que mantém o anexo visível como chip enquanto o
   * usuário mexe no resto da configuração.
   *
   * Aceita o que `extrairTexto` já sabe ler: .pdf com texto selecionável,
   * .docx e texto puro (o que cobre .csv). .xlsx entra na fase 2, junto com a
   * dependência que sabe abrir planilha.
   */
  @Post('planilha/fonte')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async fonte(
    @UploadedFile() arquivo: ArquivoEnviado | undefined,
  ): Promise<{ texto: string; origem: string; caracteres: number }> {
    if (!arquivo) {
      throw new BadRequestException('Envie um arquivo com os dados de referência.');
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
        'Não consegui extrair texto do arquivo. Use um .csv, um .docx ou um PDF com texto selecionável.',
      );
    }

    const corpo = texto.slice(0, 20000);
    return {
      // Cabeçalho com o nome do arquivo: é o que permite à IA dizer, em
      // "fontes", de qual anexo cada aba veio.
      texto: `### ${arquivo.originalname} (anexo)\n${corpo}`,
      origem: arquivo.originalname,
      caracteres: texto.length,
    };
  }
}
