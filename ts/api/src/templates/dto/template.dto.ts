import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Metadados do template. No POST chegam como campos do multipart (sempre
 * string); no PATCH, como JSON.
 */
export class CriarTemplateDto {
  // class-validator reporta de baixo para cima: a mensagem que o usuário vê
  // primeiro (message[0]) é a do decorator mais próximo do campo.
  @Transform(aparar)
  @MaxLength(120, { message: 'O nome pode ter no máximo 120 caracteres.' })
  @IsNotEmpty({ message: 'Informe o nome do template.' })
  @IsString({ message: 'Informe o nome do template.' })
  nome!: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(500, { message: 'A descrição pode ter no máximo 500 caracteres.' })
  descricao?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(120, { message: 'O contexto de uso pode ter no máximo 120 caracteres.' })
  contexto?: string;
}

export class AtualizarTemplateDto {
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do template.' })
  @MaxLength(120, { message: 'O nome pode ter no máximo 120 caracteres.' })
  nome?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(500, { message: 'A descrição pode ter no máximo 500 caracteres.' })
  descricao?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(120, { message: 'O contexto de uso pode ter no máximo 120 caracteres.' })
  contexto?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
