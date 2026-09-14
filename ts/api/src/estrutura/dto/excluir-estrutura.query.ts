import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Valor de `realocarPara` que conclui a ação sem pôr nada no lugar. */
export const SEM_REALOCACAO = 'nenhuma';

/**
 * Resolução exigida quando a Área/Cargo a excluir tem colaboradores.
 *
 * Ausente = a API recusa com 409 e a contagem, para a decisão nunca ser
 * implícita. Isso é o que impede um cliente que não conhece o modal de
 * transformar uma chamada até então recusada numa remoção silenciosa de
 * vínculo. O valor é o id da Área/Cargo de destino, ou `"nenhuma"`.
 *
 * `"nenhuma"` NÃO é "não faça nada": é "conclua sem destino", e o efeito é os
 * colaboradores ficarem sem área / sem cargo. O mesmo literal de
 * `ExcluirRoleQuery`, de propósito — dois vocabulários para o mesmo conceito
 * seria uma pegadinha para quem lê os dois arquivos.
 */
export class ExcluirEstruturaQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  realocarPara?: string;
}
