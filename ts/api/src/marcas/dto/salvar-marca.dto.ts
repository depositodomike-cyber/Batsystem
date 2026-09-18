import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Payload de criação e substituição de uma Marca — o DesignSystem inteiro.
 *
 * Espelha `DesignSystem` de
 * ts/demo/src/app/pages/ceo/design-system/types.ts. Ao mexer lá, mexa aqui —
 * mesma convenção dos outros pares duplicados do repo (catálogo de permissões,
 * catálogo de conectores).
 *
 * Aninhado, e não um `Json` cru: o ValidationPipe global roda com
 * `forbidNonWhitelisted: true` (src/bootstrap.ts), e aceitar o documento sem
 * forma desligaria a proteção exatamente no único campo que o cliente controla
 * por inteiro. O que estes limites defendem NÃO é o formato — o editor é o
 * único escritor — é o TAMANHO: quase tudo aqui é textarea livre, e uma linha
 * obesa no Postgres não tem quem a impeça depois.
 *
 * ATENÇÃO: `@ValidateNested` só faz o whitelist descer para o objeto filho
 * quando há `@Type` junto. Sem ele, aquela seção passa a aceitar qualquer campo
 * e nenhum `@MaxLength` roda — em silêncio.
 */

/** Campos de uma linha (nome, tom, fonte). */
const TEXTO_CURTO = 120;
/** Campos de textarea (propósito, regras de componentes, do/don't). */
const TEXTO_LONGO = 1_000;
/**
 * Teto do logo em data URL. ~512 KB de arquivo viram ~700 KB em base64 — o
 * editor recusa antes, no upload; isto é a segunda linha de defesa.
 */
const LIMITE_LOGO = 700_000;

class DsMarcaDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da marca.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  nome!: string;

  @IsString() @MaxLength(TEXTO_LONGO) proposito!: string;
  @IsString() @MaxLength(TEXTO_LONGO) personalidade!: string;
  @IsString() @MaxLength(TEXTO_LONGO) publico!: string;

  /**
   * Lista livre de propósito: `CONTEXTOS` no front ("Apresentação", "Web",
   * "Mobile", "Print") é sugestão da interface, não enum do domínio — fechá-lo
   * aqui quebraria a tela no dia em que um contexto novo entrasse lá.
   */
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  contexto!: string[];

  @IsString() @MaxLength(TEXTO_CURTO) tom!: string;
}

/**
 * As 11 cores. Sem `@Matches` de hexadecimal: o input é `type="color"`, mas o
 * documento também aceita o que a pessoa colar, e recusar "rgb(…)" quebraria o
 * editor sem ganho nenhum — a cor nunca é interpolada em SQL, só ecoada para o
 * renderizador.
 */
class DsCoresDto {
  @IsString() @MaxLength(32) primaria!: string;
  @IsString() @MaxLength(32) secundaria!: string;
  @IsString() @MaxLength(32) acento!: string;
  @IsString() @MaxLength(32) fundo!: string;
  @IsString() @MaxLength(32) superficie!: string;
  @IsString() @MaxLength(32) texto!: string;
  @IsString() @MaxLength(32) textoSuave!: string;
  @IsString() @MaxLength(32) sucesso!: string;
  @IsString() @MaxLength(32) erro!: string;
  @IsString() @MaxLength(32) alerta!: string;
  @IsString() @MaxLength(32) info!: string;
}

class DsTipografiaDto {
  @IsString() @MaxLength(60) fonteTitulo!: string;
  @IsString() @MaxLength(60) fonteCorpo!: string;

  @IsNumber() @Min(8) @Max(64) base!: number;
  @IsNumber() @Min(1) @Max(3) escala!: number;
  @IsInt() @Min(100) @Max(900) pesoTitulo!: number;
  @IsInt() @Min(100) @Max(900) pesoCorpo!: number;
  @IsNumber() @Min(0.8) @Max(3) lineHeight!: number;
  @IsNumber() @Min(-5) @Max(10) tracking!: number;
}

class DsEspacamentoDto {
  @IsNumber() @Min(1) @Max(64) base!: number;
  @IsInt() @Min(1) @Max(24) grid!: number;
  @IsNumber() @Min(0) @Max(64) raio!: number;
  @IsNumber() @Min(0) @Max(128) padding!: number;

  @IsString() @MaxLength(TEXTO_CURTO) breakpoints!: string;
}

class DsComponentesDto {
  @IsString() @MaxLength(TEXTO_LONGO) botoes!: string;
  @IsString() @MaxLength(TEXTO_LONGO) formularios!: string;
  @IsString() @MaxLength(TEXTO_LONGO) superficies!: string;
  @IsString() @MaxLength(TEXTO_LONGO) navegacao!: string;
  @IsString() @MaxLength(TEXTO_LONGO) tabelas!: string;
}

class DsVisualDto {
  @IsString() @MaxLength(TEXTO_LONGO) icones!: string;
  @IsString() @MaxLength(TEXTO_LONGO) ilustracoes!: string;
  @IsString() @MaxLength(TEXTO_LONGO) sombras!: string;
  @IsString() @MaxLength(TEXTO_LONGO) loading!: string;
}

class DsTokensDto {
  @IsString() @MaxLength(TEXTO_CURTO) modo!: string;
  @IsString() @MaxLength(TEXTO_LONGO) nomeacao!: string;
  @IsString() @MaxLength(TEXTO_LONGO) microinteracoes!: string;
  @IsString() @MaxLength(TEXTO_LONGO) dos!: string;
  @IsString() @MaxLength(TEXTO_LONGO) donts!: string;
}

class DsLogosDto {
  @IsString()
  @MaxLength(LIMITE_LOGO, {
    message: 'O logo para fundos claros é grande demais. Use até 512 KB.',
  })
  claro!: string;

  @IsString()
  @MaxLength(LIMITE_LOGO, {
    message: 'O logo para fundos escuros é grande demais. Use até 512 KB.',
  })
  escuro!: string;
}

/**
 * O corpo é o DesignSystem inteiro, na MESMA forma que o front já tem —
 * inclusive `logos` aninhado. A separação em colunas (`logoClaro`/`logoEscuro`)
 * é decisão de armazenamento e acontece no service; o cliente não a conhece.
 */
export class SalvarMarcaDto {
  @ValidateNested() @Type(() => DsMarcaDto) marca!: DsMarcaDto;
  @ValidateNested() @Type(() => DsCoresDto) cores!: DsCoresDto;
  @ValidateNested() @Type(() => DsTipografiaDto) tipografia!: DsTipografiaDto;
  @ValidateNested() @Type(() => DsEspacamentoDto) espacamento!: DsEspacamentoDto;
  @ValidateNested() @Type(() => DsComponentesDto) componentes!: DsComponentesDto;
  @ValidateNested() @Type(() => DsVisualDto) visual!: DsVisualDto;
  @ValidateNested() @Type(() => DsTokensDto) tokens!: DsTokensDto;
  @ValidateNested() @Type(() => DsLogosDto) logos!: DsLogosDto;
}
