import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TurnoHistoricoDto {
  @IsString()
  @MaxLength(16_000)
  pergunta!: string;

  @IsString()
  @MaxLength(32_000)
  resposta!: string;
}

/**
 * Corpo do POST /ai/orquestrar. Mesmos campos do /ai/prompt, mas em JSON de
 * verdade (sem strings com JSON dentro) e sem anexo nem agente: com @menção o
 * cliente continua usando o /ai/prompt.
 */
export class OrquestrarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16_000, { message: 'Pedido longo demais (máx. 16.000 caracteres).' })
  texto!: string;

  /** Modo usado se o pedido seguir pelo caminho direto. Padrão: auto. */
  @IsOptional()
  @IsIn(['vault', 'web', 'auto'])
  modo?: 'vault' | 'web' | 'auto';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => TurnoHistoricoDto)
  historico?: TurnoHistoricoDto[];

  /** Notas/To-do's coletados no cliente. */
  @IsOptional()
  @IsString()
  @MaxLength(12_000)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  repositorioId?: string;

  /**
   * Agentes do sistema exibidos na interface; o orquestrador só oferece
   * esses (mais os pessoais e os da organização). Ausente = todos.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  agentesSistema?: string[];

  /**
   * Como o pedido chegou. `voz_ativacao` = palavra de ativação "Oracle":
   * a política desktop trata o risco moderado como alto (SR-06b).
   */
  @IsOptional()
  @IsIn(['texto', 'voz', 'voz_ativacao'])
  origem?: 'texto' | 'voz' | 'voz_ativacao';

  /**
   * Outras transcrições do ditado (maxAlternatives): o servidor escolhe a que
   * forma um comando com um app que existe no computador ("firma" × "figma").
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  alternativas?: string[];
}
