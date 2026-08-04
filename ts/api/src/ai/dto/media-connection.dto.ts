import { IsString, MinLength } from 'class-validator';

export class SetMediaConnectionDto {
  @IsString()
  provider!: string;

  @IsString()
  model!: string;

  @IsString()
  @MinLength(8, { message: 'A chave de API parece curta demais.' })
  apiKey!: string;
}
