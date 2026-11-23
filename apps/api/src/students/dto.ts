import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxDate,
  Min,
  MinDate,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
const empty = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class StudentDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName!: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName!: string;
  @IsIn(['MALE', 'FEMALE']) sex!: 'MALE' | 'FEMALE';
  @IsOptional()
  @Transform(empty)
  @Type(() => Date)
  @IsDate()
  @MinDate(new Date('1980-01-01'))
  @MaxDate(() => new Date())
  birthDate?: Date;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 30) matricule?: string;
  @IsString() classroomId!: string;
}

export class UpdateStudentDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 60) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 60) lastName?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) sex?: 'MALE' | 'FEMALE';
  @IsOptional()
  @Transform(empty)
  @Type(() => Date)
  @IsDate()
  @MinDate(new Date('1980-01-01'))
  @MaxDate(() => new Date())
  birthDate?: Date | null;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 30) matricule?: string;
  @IsOptional() @IsString() classroomId?: string;
}

export class StudentQuery {
  @IsOptional() @IsString() yearId?: string;
  @IsOptional() @IsString() classroomId?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) sex?: 'MALE' | 'FEMALE';
  @IsOptional() @Transform(trim) @IsString() @Length(0, 80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
}
