import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Corpo do POST /ai/aprovacoes/:id/decisao. */
export class DecisaoDto {
  /** true = aprovar e executar; false = negar. */
  @IsBoolean()
  aprovar!: boolean;

  /** Motivo opcional (vai para o modelo e para a auditoria ao negar). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
