import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Transferência da propriedade da organização.
 *
 * `roleParaOwnerAtual` não aceita `"nenhuma"`, ao contrário de
 * `ExcluirRoleQuery.reatribuirPara`: quem acabou de perder o papel de conta
 * `owner` ficar sem role nenhuma é a única configuração que ninguém escolhe de
 * propósito. Ainda assim é OPCIONAL, porque zero roles segue sendo estado
 * válido no modelo — a interface o oferece com Admin pré-selecionado quando a
 * Owner era a única role de quem transfere, e aceita a escolha de não pôr
 * nenhuma.
 *
 * Quando quem transfere não tem `Membro` (é o caso de quem criou a organização
 * e nunca foi adicionado à tela de Membros), o campo é aceito e ignorado: não
 * há a quem atribuir a role.
 */
export class TransferirPropriedadeDto {
  /** Id do MEMBRO que assume — não do usuário. É o que a tela tem em mão. */
  @IsString()
  @IsNotEmpty({ message: 'Escolha para quem a propriedade será transferida.' })
  @MaxLength(60)
  novoOwnerMembroId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  roleParaOwnerAtual?: string;
}
