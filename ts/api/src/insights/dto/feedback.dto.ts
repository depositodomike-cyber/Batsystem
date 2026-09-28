import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { InsightFeedbackMotivo } from '@prisma/client';

/** "Este insight foi útil?" — 👍 (util=true) ou 👎 com motivo opcional. */
export class InsightFeedbackDto {
  @IsBoolean()
  util!: boolean;

  @IsOptional()
  @IsEnum(InsightFeedbackMotivo, { message: 'Motivo inválido.' })
  motivo?: InsightFeedbackMotivo;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'O comentário deve ter no máximo 1000 caracteres.',
  })
  comentario?: string;
}
