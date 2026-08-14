import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** Nova ordem de prioridade das conexões de uma modalidade (0 = principal). */
export class ReorderConnectionsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Envie a nova ordem das conexões.' })
  @IsString({ each: true })
  ids!: string[];
}
