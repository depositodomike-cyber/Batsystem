import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Resolução exigida quando a role a excluir tem membros.
 *
 * Ausente = a API recusa e informa a contagem, para a decisão ser sempre
 * explícita. `"nenhuma"` tira a role dos membros sem pôr outra no lugar;
 * qualquer outro valor é o id da role de destino.
 *
 * `"nenhuma"` NÃO é "deixar sem role nenhuma": ele é aceito só quando todo
 * mundo que perde esta role continua com outra. "Ao menos uma role" é regra da
 * plataforma, e quem a aplica aqui é `contarMembrosSemOutraRole`, dentro da
 * transação da exclusão.
 */
export class ExcluirRoleQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reatribuirPara?: string;
}
