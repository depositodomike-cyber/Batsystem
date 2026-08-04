import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Uma nota .md do lote (o conteúdo já foi lido no navegador). */
export class VaultNotaDto {
  @IsString()
  @IsNotEmpty({ message: 'Caminho da nota é obrigatório.' })
  @MaxLength(1024)
  path!: string;

  @IsString()
  @MaxLength(512)
  titulo!: string;

  @IsString()
  // Notas .md podem ser longas; limite generoso, mas defensivo.
  @MaxLength(200_000, { message: 'Nota muito grande (máx. 200k caracteres).' })
  conteudo!: string;
}

/** Lote de notas para sincronizar. Enviado em partes pelo cliente. */
export class SyncVaultBatchDto {
  @IsArray()
  @ArrayMaxSize(100, { message: 'No máximo 100 notas por lote.' })
  @ValidateNested({ each: true })
  @Type(() => VaultNotaDto)
  notas!: VaultNotaDto[];
}

/** Lista completa dos caminhos atuais, para podar os removidos. */
export class FinalizeVaultDto {
  @IsArray()
  @ArrayMaxSize(20_000, { message: 'Vault grande demais para sincronizar.' })
  @IsString({ each: true })
  paths!: string[];
}
