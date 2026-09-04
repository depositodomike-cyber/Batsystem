import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payload de criação de uma Área ou de um Cargo — o mesmo DTO para os dois,
 * porque os campos são idênticos.
 *
 * Não há `status` aqui de propósito: toda entidade nasce `ativo`, e desativar
 * é uma ação de edição. Mesma escolha de `Membro`, que nasce sempre como
 * `convite_pendente`.
 */
export class CriarEstruturaDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  nome!: string;

  /**
   * Informação complementar, sem nenhum efeito sobre permissão, hierarquia ou
   * acesso a dados.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
  descricao?: string;
}
