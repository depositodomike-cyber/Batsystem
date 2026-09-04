import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Payload de criação de uma role personalizada. */
export class CriarRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da role.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
  descricao?: string;

  /**
   * Códigos do catálogo. Código desconhecido é descartado e as dependências
   * são acrescentadas pelo service (`normalizarPermissoes`), então não há
   * validação de valor aqui — só de forma.
   */
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissoes!: string[];
}
