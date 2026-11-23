import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
/** Champ facultatif laissé vide dans le formulaire = absent. */
const blank = ({ value }: { value: unknown }) => {
  const v = trim({ value });
  return v === '' ? undefined : v;
};

export class TeacherDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName!: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName!: string;
  @IsOptional() @Transform(blank) @IsIn(['MALE', 'FEMALE']) sex?:
    'MALE' | 'FEMALE';
  @IsOptional() @Transform(blank) @IsEmail() @Length(3, 120) email?: string;
  @IsOptional() @Transform(blank) @IsString() @Length(6, 30) phone?: string;
  @IsOptional() @Transform(blank) @IsString() @Length(2, 160) address?: string;
  @IsOptional() @Transform(blank) @IsString() @Length(1, 30) matricule?: string;
}

export class TeacherQuery {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 80) q?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() classroomId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
}

export class AssignmentsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  subjectIds!: string[];
}
