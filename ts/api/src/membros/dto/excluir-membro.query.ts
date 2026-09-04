import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Resolução exigida quando o membro a excluir lidera alguém.
 *
 * Ausente = a API recusa com 409 e a contagem, para a decisão nunca ser
 * implícita. O valor é o id do membro que assume os liderados DIRETOS.
 *
 * Não existe valor especial para "deixar sem gestor", ao contrário de
 * `ExcluirRoleQuery`: aceitá-lo seria a via de contorno da própria regra, que
 * existe justamente porque o `onDelete: SetNull` do banco já fazia isso em
 * silêncio.
 */
export class ExcluirMembroQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reatribuirLiderados?: string;
}
