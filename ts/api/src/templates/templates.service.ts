import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AtualizarTemplateDto, CriarTemplateDto } from './dto/template.dto';
import { ErroProcessamento, processarTemplate } from './processar';
import {
  SELECT_SEM_ARQUIVO,
  toTemplateCompleto,
  toTemplatePublico,
  type TemplateCompleto,
  type TemplatePublico,
} from './template.mapper';

export interface ArquivoRecebido {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/**
 * Templates de apresentação da organização.
 *
 * Mesmo contrato de isolamento das Marcas: toda consulta leva `empresaId` no
 * `where`, e o id sozinho nunca alcança o registro de outra organização.
 */
@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    empresaId: string,
    opcoes: { soAtivos?: boolean } = {},
  ): Promise<TemplatePublico[]> {
    const itens = await this.prisma.templateApresentacao.findMany({
      where: { empresaId, ...(opcoes.soAtivos ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
      select: SELECT_SEM_ARQUIVO,
    });
    return itens.map(toTemplatePublico);
  }

  async obter(empresaId: string, id: string): Promise<TemplateCompleto> {
    return toTemplateCompleto(await this.exigir(empresaId, id));
  }

  /** Processa um arquivo sem gravar nada (prévia do formulário). */
  async analisar(arquivo: ArquivoRecebido | undefined) {
    if (!arquivo) throw new BadRequestException('Envie o arquivo do template.');
    const { formato, estrutura } = await processar(
      arquivo.buffer,
      nomeDoArquivo(arquivo.originalname),
    );
    return { formato, estrutura };
  }

  /**
   * Processa ANTES de gravar: um arquivo que não pode ser interpretado nunca
   * vira registro. Não existe template "processando" ou "com erro" no banco.
   */
  async criar(
    empresaId: string,
    dto: CriarTemplateDto,
    arquivo: ArquivoRecebido | undefined,
  ): Promise<TemplateCompleto> {
    if (!arquivo) throw new BadRequestException('Envie o arquivo do template.');
    await this.exigirNomeLivre(empresaId, dto.nome);
    const nomeArquivo = nomeDoArquivo(arquivo.originalname);
    const { formato, mime, estrutura } = await processar(arquivo.buffer, nomeArquivo);

    try {
      const criado = await this.prisma.templateApresentacao.create({
        data: {
          empresaId,
          nome: dto.nome,
          descricao: dto.descricao || null,
          contexto: dto.contexto || null,
          formato,
          arquivoNome: nomeArquivo,
          arquivoMime: mime,
          arquivoTamanho: arquivo.size,
          arquivo: new Uint8Array(arquivo.buffer),
          estrutura: estrutura as unknown as Prisma.InputJsonValue,
        },
        select: SELECT_SEM_ARQUIVO,
      });
      return toTemplateCompleto(criado);
    } catch (erro) {
      throw traduzirConflito(erro);
    }
  }

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarTemplateDto,
  ): Promise<TemplateCompleto> {
    await this.exigir(empresaId, id);
    if (dto.nome !== undefined) await this.exigirNomeLivre(empresaId, dto.nome, id);

    try {
      const atualizado = await this.prisma.templateApresentacao.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          // "" limpa o campo opcional; ausente não mexe.
          ...(dto.descricao !== undefined ? { descricao: dto.descricao || null } : {}),
          ...(dto.contexto !== undefined ? { contexto: dto.contexto || null } : {}),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        },
        select: SELECT_SEM_ARQUIVO,
      });
      return toTemplateCompleto(atualizado);
    } catch (erro) {
      throw traduzirConflito(erro);
    }
  }

  /**
   * Troca o arquivo. O novo é processado primeiro; se falhar, a exceção sai
   * daqui sem que nada tenha sido escrito — o arquivo e a estrutura anteriores
   * continuam valendo. Só com sucesso a versão sobe.
   */
  async trocarArquivo(
    empresaId: string,
    id: string,
    arquivo: ArquivoRecebido | undefined,
  ): Promise<TemplateCompleto> {
    if (!arquivo) throw new BadRequestException('Envie o novo arquivo.');
    await this.exigir(empresaId, id);
    const nomeArquivo = nomeDoArquivo(arquivo.originalname);
    const { formato, mime, estrutura } = await processar(arquivo.buffer, nomeArquivo);

    const atualizado = await this.prisma.templateApresentacao.update({
      where: { id },
      data: {
        formato,
        arquivoNome: nomeArquivo,
        arquivoMime: mime,
        arquivoTamanho: arquivo.size,
        arquivo: new Uint8Array(arquivo.buffer),
        estrutura: estrutura as unknown as Prisma.InputJsonValue,
        versao: { increment: 1 },
      },
      select: SELECT_SEM_ARQUIVO,
    });
    return toTemplateCompleto(atualizado);
  }

  async baixar(
    empresaId: string,
    id: string,
  ): Promise<{ nome: string; mime: string; conteudo: Buffer }> {
    const t = await this.prisma.templateApresentacao.findFirst({
      where: { id, empresaId },
      select: { arquivoNome: true, arquivoMime: true, arquivo: true },
    });
    if (!t) throw new NotFoundException('Template não encontrado.');
    return { nome: t.arquivoNome, mime: t.arquivoMime, conteudo: Buffer.from(t.arquivo) };
  }

  /**
   * Hard-delete. As criações que usaram o template guardam a própria cópia da
   * estrutura (id, nome, versão), então nada histórico é afetado.
   */
  async remover(empresaId: string, id: string): Promise<void> {
    await this.exigir(empresaId, id);
    await this.prisma.templateApresentacao.delete({ where: { id } });
  }

  private async exigir(empresaId: string, id: string) {
    const t = await this.prisma.templateApresentacao.findFirst({
      where: { id, empresaId },
      select: SELECT_SEM_ARQUIVO,
    });
    if (!t) throw new NotFoundException('Template não encontrado.');
    return t;
  }

  /** Mesmo pré-check insensitive das Marcas (a unique do Postgres não é). */
  private async exigirNomeLivre(
    empresaId: string,
    nome: string,
    exceto?: string,
  ): Promise<void> {
    const existente = await this.prisma.templateApresentacao.findFirst({
      where: { empresaId, nome: { equals: nome, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existente && existente.id !== exceto) {
      throw new ConflictException('Já existe um template com este nome.');
    }
  }
}

async function processar(buffer: Buffer, nomeArquivo: string) {
  try {
    return await processarTemplate(buffer, nomeArquivo);
  } catch (erro) {
    if (erro instanceof ErroProcessamento) {
      throw new UnprocessableEntityException(erro.message);
    }
    // Falha inesperada do leitor: ainda assim uma mensagem útil, sem vazar stack.
    throw new UnprocessableEntityException(
      'Não foi possível processar o arquivo. Verifique se ele abre normalmente e tente de novo.',
    );
  }
}

/**
 * O multer entrega `originalname` decodificado como latin1. Mesmo tratamento
 * de repositorio-org.service.ts.
 */
function nomeDoArquivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  const nome = utf8.includes('�') ? original : utf8;
  return nome.trim().slice(0, 255) || 'template';
}

function traduzirConflito(erro: unknown): unknown {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === 'P2002'
  ) {
    return new ConflictException('Já existe um template com este nome.');
  }
  return erro;
}
