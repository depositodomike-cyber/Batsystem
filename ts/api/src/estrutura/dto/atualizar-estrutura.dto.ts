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

  /**
   * Destino OPCIONAL dos colaboradores, honrado só quando este PATCH desativa
   * (ativo → inativo). Em qualquer outra edição é aceito e ignorado — mesma
   * convenção de `AtualizarMembroDto.reatribuirLiderados`.
   *
   * Ausente não é omissão de decisão, ao contrário da exclusão: desativar sem
   * realocar preserva os vínculos, e é um desfecho legítimo. Por isso aqui não
   * há 409 quando o campo falta.
   *
   * Não aceita o `"nenhuma"` de `ExcluirEstruturaQuery`: "desativar deixando
   * todo mundo sem área" não é uma operação que a tela oferece, e aceitá-la
   * seria a via de contorno da própria distinção entre desativar e excluir.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  realocarPara?: string;
}
