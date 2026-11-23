import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class SlotDto {
  @IsString() teachingId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(6) weekday!: number;
  @Matches(HHMM, { message: 'Heure de début invalide (HH:MM).' })
  start!: string;
  @Matches(HHMM, { message: 'Heure de fin invalide (HH:MM).' }) end!: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @Length(1, 30)
  room?: string;
}

export class SlotQuery {
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() classroomId?: string;
}
