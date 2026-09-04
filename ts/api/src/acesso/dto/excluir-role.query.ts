import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Resolução exigida quando a role a excluir tem membros.
 *
 * Ausente = a API recusa e informa a contagem, para a decisão ser sempre
 * explícita. `"nenhuma"` deixa os membros sem role; qualquer outro valor é o id
 * da role de destino.
 */
export class ExcluirRoleQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reatribuirPara?: string;
}
