import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstruturaStatus } from '@prisma/client';

/**
 * Filtros da listagem. Ambos opcionais; sem nada, devolve ativos e inativos —
 * a tela precisa dos dois para mostrar o que foi desativado.
 */
export class ListarEstruturaQuery {
  @IsOptional()
  @IsEnum(EstruturaStatus, { message: 'Status inválido.' })
  status?: EstruturaStatus;

  /** Busca livre em nome e descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
