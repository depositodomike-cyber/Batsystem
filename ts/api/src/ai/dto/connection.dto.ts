import { IsString } from 'class-validator';

export class SetConnectionDto {
  @IsString()
  credentialId!: string;

  @IsString()
  model!: string;
}
