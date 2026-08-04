import { IsEnum, IsString, MinLength } from 'class-validator';
import { AiProvider } from '@prisma/client';

export class SetConnectionDto {
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @IsString()
  model!: string;

  @IsString()
  @MinLength(8, { message: 'A chave de API parece curta demais.' })
  apiKey!: string;
}
