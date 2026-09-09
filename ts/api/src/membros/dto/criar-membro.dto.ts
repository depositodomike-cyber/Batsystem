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
import { MembroStatus, MembroTipo } from '@prisma/client';

import { MAX_GESTORES_INDIRETOS } from '../membros.constants';

/** Payload de criação de um membro da organização (V1: sem papel/permissão). */
export class CriarMembroDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do membro.' })
  @MaxLength(160, { message: 'O nome deve ter no máximo 160 caracteres.' })
  nome!: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(200)
  email!: string;

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

  /**
   * Tipo de vínculo com a organização. Omitido = `membro`, que é o fluxo de
   * sempre — nenhum cadastro existente vira convidado por omissão.
   *
   * `convidado` é acesso externo: fica fora do organograma, não tem área,
   * cargo, gestor direto nem gestores indiretos, não pode ser gestor de
   * ninguém, e recebe automaticamente a role Convidado — exclusivamente ela.
   *
   * NÃO confundir com `status`: os dois eixos são independentes, e existe
   * convidado ativo, com convite pendente e inativo.
   */
  @IsOptional()
  @IsEnum(MembroTipo, { message: 'Tipo de membro inválido.' })
  tipo?: MembroTipo;

  @IsOptional()
  @IsString()
  gestorId?: string;

  /**
   * Gestores indiretos: ids de membros da MESMA organização que acompanham
   * esta pessoa sem definir a posição dela na estrutura.
   *
   * Relação MÚLTIPLA e DIRECIONAL, ao contrário de `gestorId`: apontar G aqui
   * não cria nada no sentido inverso. Sem ordem e sem prioridade entre si — a
   * resposta vem em ordem alfabética, e nenhum deles é "o principal".
   *
   * Não concede nada: nem acesso a dados, nem permissão, nem role, nem
   * participação em equipe para fins de autorização.
   *
   * Lista vazia ou omitida = sem gestores indiretos, que é o estado de todo
   * membro anterior a esta versão. Ids repetidos são deduplicados pelo service
   * (o banco também recusa, pela unique do vínculo), e o gestor DIRETO não
   * pode aparecer aqui — ver `resolverGestoresIndiretos`.
   *
   * O teto abaixo é a primeira barreira; o teto real é aplicado no service,
   * DEPOIS do dedupe, porque `@ArrayMaxSize` não deduplica.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GESTORES_INDIRETOS, {
    message: `Um membro pode ter no máximo ${MAX_GESTORES_INDIRETOS} gestores indiretos.`,
  })
  @IsString({ each: true })
  gestorIndiretoIds?: string[];

  /**
   * LEGADO (pré-V6): aceito e IGNORADO na escrita, como `area` e `cargo`.
   *
   * Honrá-lo seria destrutivo: o formulário manda todos os campos em todo save,
   * então um bundle antigo mandaria `roleId: ""` e apagaria as roles do membro
   * numa edição de qualquer outro campo. O campo continua declarado porque o
   * `forbidNonWhitelisted` do bootstrap daria 400 sem ele.
   */
  @IsOptional()
  @IsString()
  roleId?: string;

  /**
   * Roles do membro: de uma a duas, sem prioridade entre elas. As permissões
   * efetivas são a UNIÃO das permissões dessas roles.
   *
   * Ao menos uma é OBRIGATÓRIA para membro comum — sem role a pessoa fica
   * cadastrada sem poder fazer nada. A exigência não é um `@ArrayNotEmpty`
   * aqui porque ela depende de `tipo`: para `convidado` a lista tem de vir
   * VAZIA (a role Convidado é atribuída pelo serviço, e mandá-la daqui criaria
   * duas fontes de verdade). Quem aplica as duas metades é o MembrosService.
   *
   * Ids repetidos são deduplicados pelo service, e a mesma role não entra duas
   * vezes (o banco também recusa, pela unique do vínculo).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Um membro pode ter no máximo 2 roles.' })
  @IsString({ each: true })
  roleIds?: string[];

  /**
   * Omitido = `convite_pendente` (o default do banco), que é o fluxo da tela.
   * `ativo` é aceito para importações/seed de quem já faz parte do time.
   */
  @IsOptional()
  @IsEnum(MembroStatus, { message: 'Status inválido.' })
  status?: MembroStatus;
}
