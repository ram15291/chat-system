import { IsUUID } from 'class-validator';

export class CreateDmDto {
  @IsUUID()
  other_user_id: string;
}
