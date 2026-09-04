import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MembroStatus } from '@prisma/client';

/** Payload de edição. Tudo opcional: a tela envia só o que mudou. */
export class AtualizarMembroDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do membro.' })
  @MaxLength(160, { message: 'O nome deve ter no máximo 160 caracteres.' })
  nome?: string;

  /** Recusado para membro que já tem conta — ver MembrosService.atualizar(). */
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(200)
  email?: string;

  /**
   * LEGADO (pré-V4): aceito e IGNORADO.
   *
   * Guardava o código do catálogo estático de áreas. Hoje quem vale é
   * `areaId`. O campo continua declarado de propósito: o bootstrap usa
   * `forbidNonWhitelisted`, então removê-lo daria 400 em todo save feito por
   * um bundle antigo que ainda o envia.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  /** LEGADO (pré-V4): aceito e IGNORADO, como `area`. Hoje vale `cargoId`. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargo?: string;

  /**
   * Área da organização (id de uma Area do MESMO tenant).
   *
   * Responde ONDE a pessoa está alocada. String vazia limpa, mesma convenção
   * de `gestorId`/`roleId`. Área inativa é recusada como escolha nova, mas a
   * associação já existente de um membro continua válida.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  areaId?: string;

  /**
   * Cargo da organização (id de um Cargo do MESMO tenant).
   *
   * Responde QUAL POSIÇÃO profissional a pessoa ocupa. NÃO define hierarquia
   * (isso é `gestorId`) nem concede permissão (isso é `roleId`).
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cargoId?: string;

  /**
   * Gestor direto (id de outro membro da MESMA organização).
   *
   * Omitido = sem gestor. String vazia limpa a relação, mesma convenção de
   * `area`/`cargo`. As regras (mesmo tenant, não a si mesmo, sem ciclo) ficam
   * no MembrosService, que é onde a árvore pode ser consultada.
   */
  @IsOptional()
  @IsString()
  gestorId?: string;

  /**
   * LEGADO (pré-V6): aceito e IGNORADO na escrita, como `area` e `cargo`.
   * Ver o comentário em `CriarMembroDto` — honrá-lo apagaria as roles do
   * membro num save vindo de um bundle antigo.
   */
  @IsOptional()
  @IsString()
  roleId?: string;

  /**
   * Roles do membro: até duas, sem prioridade entre elas. As permissões
   * efetivas são a UNIÃO das permissões dessas roles.
   *
   * Lista vazia ou omitida = sem role, que continua sendo estado válido. Ids
   * repetidos são deduplicados pelo service, e a mesma role não entra duas
   * vezes (o banco também recusa, pela unique do vínculo).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Um membro pode ter no máximo 2 roles.' })
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsEnum(MembroStatus, { message: 'Status inválido.' })
  status?: MembroStatus;

  /**
   * Nova liderança dos liderados diretos, exigida quando este PATCH desativa
   * um membro que lidera alguém: desativar também é sair da estrutura, e a
   * equipe não pode ficar sem gestor.
   *
   * Só é considerado na transição para `inativo`; em qualquer outra edição é
   * aceito e ignorado. É o id de outro membro da MESMA organização, e não pode
   * ser alguém que responda ao próprio membro (criaria um ciclo).
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reatribuirLiderados?: string;
}
