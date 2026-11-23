import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class PeriodDto {
  @Transform(trim) @IsString() @Length(2, 40) name!: string;
  @Type(() => Date) @IsDate() startsOn!: Date;
  @Type(() => Date) @IsDate() endsOn!: Date;
}

export class YearDto {
  @Matches(/^\d{4}-\d{4}$/) label!: string;
  @Type(() => Date) @IsDate() startsOn!: Date;
  @Type(() => Date) @IsDate() endsOn!: Date;
  @IsIn(['TRIMESTER', 'SEMESTER']) periodType!: 'TRIMESTER' | 'SEMESTER';
  /** Absent : découpage automatique en périodes égales. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PeriodDto)
  periods?: PeriodDto[];
}

export class UpdateYearDto {
  @IsOptional() @Matches(/^\d{4}-\d{4}$/) label?: string;
  @IsOptional() @Type(() => Date) @IsDate() startsOn?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsOn?: Date;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PeriodDto)
  periods?: PeriodDto[];
}

export class NameDto {
  @Transform(trim) @IsString() @Length(1, 40) name!: string;
}

export class SubjectDto {
  @Transform(trim) @IsString() @Length(2, 60) name!: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 12) shortName?: string;
}

export class UpdateSubjectDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 60) name?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 12) shortName?: string;
}

export class OrderDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
}

export class LevelSubjectDto {
  @IsString() subjectId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.25) @Max(20) coefficient!: number;
}

export class LevelSubjectsDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => LevelSubjectDto)
  items!: LevelSubjectDto[];
}

export class ClassroomDto {
  @IsString() yearId!: string;
  @IsString() levelId!: string;
  @Transform(trim) @IsString() @Length(1, 40) name!: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) capacity?: number;
}

export class UpdateClassroomDto {
  @IsOptional() @IsString() levelId?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 40) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) capacity?: number | null;
}
