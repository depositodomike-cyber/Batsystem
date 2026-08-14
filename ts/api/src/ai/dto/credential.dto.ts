import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCredentialDto {
  @IsString()
  provider!: string;

  @IsString()
  @MinLength(8, { message: 'A chave de API parece curta demais.' })
  apiKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome?: string;
}
