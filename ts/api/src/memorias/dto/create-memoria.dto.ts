import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MemoriaConfianca } from '@prisma/client';

/** Payload de criação de uma memória (campos espelham o front: MemoryItem). */
export class CreateMemoriaDto {
  /**
   * Tema = pasta da Memória (ex.: "Reuniões", "Artigos"). Opcional: a tela de
   * Diretrizes não pede tema — diretriz vale para toda resposta da IA, não por
   * assunto —, e nesse caso o backend grava CATEGORIA_PADRAO. Continua vindo
   * dos fluxos que gravam numa pasta específica (Notas, E-mail, Slack).
   */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  category?: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe um resumo.' })
  @MaxLength(160, { message: 'O resumo deve ter no máximo 160 caracteres.' })
  title!: string;

  // 8000 e não 2000: o conteúdo deixou de ser só digitado à mão — vem de
  // e-mail, thread do Slack e documento inteiros, que passam fácil de 2000
  // caracteres. A coluna é `text` no Postgres, então não há limite de banco.
  @IsString()
  @IsNotEmpty({ message: 'Descreva o que a IA deve lembrar.' })
  @MaxLength(8000, { message: 'O conteúdo deve ter no máximo 8000 caracteres.' })
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsEnum(MemoriaConfianca, { message: 'Confiança inválida.' })
  confidence?: MemoriaConfianca;

  /** Fixar como definição corporativa (read-only). Só admin/owner. */
  @IsOptional()
  @IsBoolean()
  corporate?: boolean;
}
