import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MemoriaConfianca } from '@prisma/client';

/** Atualização parcial de uma memória (inclui o toggle de ativa). */
export class UpdateMemoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  // Mesmo limite da criação (ver create-memoria.dto.ts): editar uma memória
  // vinda de e-mail/Slack não pode falhar por um teto menor que o da gravação.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsEnum(MemoriaConfianca, { message: 'Confiança inválida.' })
  confidence?: MemoriaConfianca;

  /** Liga/desliga o uso da memória pela IA. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
