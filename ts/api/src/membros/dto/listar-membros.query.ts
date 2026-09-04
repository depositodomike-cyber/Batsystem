import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MembroStatus } from '@prisma/client';

/** Filtros da listagem. Ambos opcionais; sem nada, devolve o time inteiro. */
export class ListarMembrosQuery {
  @IsOptional()
  @IsEnum(MembroStatus, { message: 'Status inválido.' })
  status?: MembroStatus;

  /** Busca livre em nome, e-mail, área e cargo. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
