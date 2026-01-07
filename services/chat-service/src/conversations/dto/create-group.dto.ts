import { IsString, IsUUID, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(99) // Creator + 99 members = 100 max
  member_ids: string[];
}
