import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMcpKeyDto {
  /** Rótulo da chave, ex.: "Claude do CEO". */
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome!: string;
}
