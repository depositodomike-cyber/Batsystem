import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstruturaStatus } from '@prisma/client';

/** Payload de edição. Tudo opcional: a tela envia só o que mudou. */
export class AtualizarEstruturaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  nome?: string;

  /** String vazia limpa a descrição (convenção de área/cargo em membros). */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
  descricao?: string;

  /**
   * `inativo` é o caminho não destrutivo: preserva o registro, o histórico e
   * as associações existentes, e só tira a entidade das escolhas novas.
   */
  @IsOptional()
  @IsEnum(EstruturaStatus, { message: 'Status inválido.' })
  status?: EstruturaStatus;
}
