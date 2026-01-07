import { IsInt, Min } from 'class-validator';

export class UpdateReadDto {
  @IsInt()
  @Min(1)
  last_read_seq: number;
}
