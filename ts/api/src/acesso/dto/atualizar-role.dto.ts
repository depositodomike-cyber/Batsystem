import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Payload de edição. Tudo opcional: a tela envia só o que mudou. */
export class AtualizarRoleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da role.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  nome?: string;

  /** String vazia limpa a descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
  descricao?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissoes?: string[];
}
