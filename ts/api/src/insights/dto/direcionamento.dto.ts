import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DirecionamentoPrioridade, DirecionamentoTipo } from '@prisma/client';

export const DIRECIONAMENTO_MAX_NOME = 120;
export const DIRECIONAMENTO_MAX_INSTRUCAO = 2000;

/** Payload de criação de um item do "Direcionador de insights". */
export class CreateDirecionamentoDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe um nome.' })
  @MaxLength(DIRECIONAMENTO_MAX_NOME, {
    message: `O nome deve ter no máximo ${DIRECIONAMENTO_MAX_NOME} caracteres.`,
  })
  nome!: string;

  @IsEnum(DirecionamentoTipo, { message: 'Escolha o que você deseja fazer.' })
  tipo!: DirecionamentoTipo;

  @IsString()
  @IsNotEmpty({ message: 'Descreva o que a IA deve observar.' })
  @MaxLength(DIRECIONAMENTO_MAX_INSTRUCAO, {
    message: `A orientação deve ter no máximo ${DIRECIONAMENTO_MAX_INSTRUCAO} caracteres.`,
  })
  instrucao!: string;

  /** Área observada. `null`/ausente = toda a organização. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  areaId?: string | null;

  @IsOptional()
  @IsEnum(DirecionamentoPrioridade, { message: 'Prioridade inválida.' })
  prioridade?: DirecionamentoPrioridade;
}

/** Edição parcial — inclui ativar/desativar. */
export class UpdateDirecionamentoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe um nome.' })
  @MaxLength(DIRECIONAMENTO_MAX_NOME, {
    message: `O nome deve ter no máximo ${DIRECIONAMENTO_MAX_NOME} caracteres.`,
  })
  nome?: string;

  @IsOptional()
  @IsEnum(DirecionamentoTipo, { message: 'Tipo inválido.' })
  tipo?: DirecionamentoTipo;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Descreva o que a IA deve observar.' })
  @MaxLength(DIRECIONAMENTO_MAX_INSTRUCAO, {
    message: `A orientação deve ter no máximo ${DIRECIONAMENTO_MAX_INSTRUCAO} caracteres.`,
  })
  instrucao?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  areaId?: string | null;

  @IsOptional()
  @IsEnum(DirecionamentoPrioridade, { message: 'Prioridade inválida.' })
  prioridade?: DirecionamentoPrioridade;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
