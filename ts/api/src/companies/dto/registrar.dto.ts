import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Cadastro mínimo (nome, e-mail, senha, workspace).
 *
 * O funil completo (`POST /cadastro`) pede cobrança/documento/módulos. Este
 * endpoint existe para o fluxo novo de contas criar a empresa + owner no
 * backend sem repetir aquele formulário — os defaults de trial/plano são
 * aplicados no service.
 */
export class RegistrarDto {
  @IsString()
  @MinLength(2, { message: 'Informe o seu nome.' })
  @MaxLength(120)
  nome!: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @MaxLength(72)
  senha!: string;

  /** Nome do workspace. Se omitido, usa o nome da pessoa. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  workspaceNome?: string;
}
