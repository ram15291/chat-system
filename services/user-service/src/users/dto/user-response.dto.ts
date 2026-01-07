import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  user_id: string;

  @Expose()
  email: string;

  @Expose()
  username: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;
}
