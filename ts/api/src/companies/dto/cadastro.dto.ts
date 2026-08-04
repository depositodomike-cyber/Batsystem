import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CicloCobranca,
  ModuloCode,
  PlanoCode,
  TipoPessoa,
} from '@prisma/client';

/** Plano e quantidade de UM módulo (modelo da calculadora). */
export class ConfigModuloDto {
  @IsEnum(ModuloCode)
  modulo!: ModuloCode;

  @IsEnum(PlanoCode)
  plano!: PlanoCode;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantidade!: number;
}

class ResponsavelDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(30)
  telefone!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @MaxLength(128)
  senha!: string;
}

export class CadastroDto {
  @IsEnum(TipoPessoa)
  tipoPessoa!: TipoPessoa;

  @IsString()
  @MaxLength(20)
  documento!: string;

  @IsString()
  @MaxLength(200)
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  setor?: string;

  @IsEnum(PlanoCode)
  plano!: PlanoCode;

  @IsEnum(CicloCobranca)
  ciclo!: CicloCobranca;

  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um módulo.' })
  @IsEnum(ModuloCode, { each: true })
  modulos!: ModuloCode[];

  /** Plano e quantidade por módulo. Quando presente, define o preço. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigModuloDto)
  configuracoes?: ConfigModuloDto[];

  @IsInt()
  @Min(0)
  @Max(100_000)
  usuarios!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  posicoes!: number;

  @ValidateNested()
  @Type(() => ResponsavelDto)
  responsavel!: ResponsavelDto;
}
