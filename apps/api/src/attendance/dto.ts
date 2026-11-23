import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class RollCallItem {
  @IsString() studentId!: string;
  @IsIn(['PRESENT', 'ABSENT', 'LATE']) status!: 'PRESENT' | 'ABSENT' | 'LATE';
}

export class RollCallDto {
  @IsString() classroomId!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) day?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RollCallItem)
  items!: RollCallItem[];
}
