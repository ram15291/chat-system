import { IsUUID } from 'class-validator';

export class CreateInviteDto {
  @IsUUID()
  user_id: string;
}
