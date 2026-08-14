import { IsString } from 'class-validator';

export class SetMediaConnectionDto {
  @IsString()
  credentialId!: string;

  @IsString()
  model!: string;
}
