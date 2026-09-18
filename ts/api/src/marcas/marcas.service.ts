import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marca, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SalvarMarcaDto } from './dto/salvar-marca.dto';
import { toMarcaPublica, type MarcaPublica } from './marca.mapper';

/**
 * Guias de marca da organização.
 *
 * Toda consulta carrega `empresaId` no `where` — é onde o isolamento entre
 * organizações acontece de verdade, e não na interface.
 */
@Injectable()
export class MarcasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string): Promise<MarcaPublica[]> {
    const marcas = await this.prisma.marca.findMany({
      where: { empresaId },
      orderBy: { nome: 'asc' },
    });
    return marcas.map(toMarcaPublica);
  }

  async obter(empresaId: string, id: string): Promise<MarcaPublica> {
    return toMarcaPublica(await this.exigir(empresaId, id));
  }

  async criar(empresaId: string, dto: SalvarMarcaDto): Promise<MarcaPublica> {
    const dados = separar(dto);
    await this.exigirNomeLivre(empresaId, dados.nome);

    try {
      return toMarcaPublica(
        await this.prisma.marca.create({ data: { empresaId, ...dados } }),
      );
    } catch (erro) {
      throw traduzirConflito(erro);
    }
  }

  /**
   * Substitui o documento inteiro. PUT e não PATCH: o editor é um formulário de
   * oito seções com estado único e sempre submete tudo — um PATCH aninhado teria
   * de decidir, campo a campo, entre "ausente = não mexer" e "ausente = limpar",
   * ambiguidade que aqui não existe.
   */
  async substituir(
    empresaId: string,
    id: string,
    dto: SalvarMarcaDto,
  ): Promise<MarcaPublica> {
    await this.exigir(empresaId, id);
    const dados = separar(dto);
    await this.exigirNomeLivre(empresaId, dados.nome, id);

    try {
      return toMarcaPublica(
        await this.prisma.marca.update({ where: { id }, data: dados }),
      );
    } catch (erro) {
      throw traduzirConflito(erro);
    }
  }

  /**
   * Exclui de vez. Não há soft-delete nem a regra "a última não pode ser
   * removida" que o store de localStorage tinha: aquela existia só porque o
   * store precisava de uma marca ativa a todo momento, e nada no banco
   * referencia uma Marca. Zero marcas é um estado de primeira classe — as telas
   * do AI Studio caem no estilo padrão da plataforma.
   */
  async remover(empresaId: string, id: string): Promise<void> {
    await this.exigir(empresaId, id);
    await this.prisma.marca.delete({ where: { id } });
  }

  /**
   * `findFirst` com empresaId no where, e não `findUnique` pelo id: o id
   * sozinho não pode ser suficiente para alcançar a marca de outra organização.
   */
  private async exigir(empresaId: string, id: string): Promise<Marca> {
    const marca = await this.prisma.marca.findFirst({
      where: { id, empresaId },
    });
    if (!marca) throw new NotFoundException('Marca não encontrada.');
    return marca;
  }

  /**
   * A unique do Postgres é case-sensitive, então "Acme" e "acme" passariam as
   * duas — e ficariam indistinguíveis na tabela e no seletor. O pré-check
   * insensitive é o que resolve o caso comum; o P2002 lá em cima cobre a corrida
   * entre dois administradores salvando o mesmo nome no mesmo instante.
   */
  private async exigirNomeLivre(
    empresaId: string,
    nome: string,
    exceto?: string,
  ): Promise<void> {
    const existente = await this.prisma.marca.findFirst({
      where: { empresaId, nome: { equals: nome, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existente && existente.id !== exceto) {
      throw new ConflictException('Já existe uma marca com este nome.');
    }
  }
}

/**
 * Separa o payload nas três formas em que ele é gravado: o nome em coluna, o
 * documento em Json e os logos em colunas de texto.
 *
 * `nome` e `conteudo.marca.nome` saem daqui com o MESMO valor, já aparado, e são
 * gravados na mesma escrita. Divergir faria a coluna (unique, ordenação) contar
 * uma história e o documento (o que a tela exibe) contar outra.
 */
function separar(dto: SalvarMarcaDto) {
  const { logos, ...resto } = dto;
  const nome = resto.marca.nome.trim();
  const conteudo = { ...resto, marca: { ...resto.marca, nome } };

  return {
    nome,
    conteudo: conteudo as unknown as Prisma.InputJsonValue,
    // String vazia vira null: "sem logo" é ausência, não um texto vazio.
    logoClaro: logos.claro || null,
    logoEscuro: logos.escuro || null,
  };
}

function traduzirConflito(erro: unknown): unknown {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === 'P2002'
  ) {
    return new ConflictException('Já existe uma marca com este nome.');
  }
  return erro;
}
