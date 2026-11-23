import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
/** Champ facultatif laissé vide dans le formulaire = absent. */
const blank = ({ value }: { value: unknown }) => {
  const v = trim({ value });
  return v === '' ? undefined : v;
};

export const RELATIONS = ['FATHER', 'MOTHER', 'GUARDIAN'] as const;
export type Relation = (typeof RELATIONS)[number];

export class ChildDto {
  @IsString() studentId!: string;
  @IsIn(RELATIONS) relation!: Relation;
}

export class ParentDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName!: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName!: string;
  @Transform(trim) @IsString() @Length(6, 30) phone!: string;
  @IsOptional() @Transform(blank) @IsEmail() @Length(3, 120) email?: string;
  @IsOptional() @Transform(blank) @IsString() @Length(2, 160) address?: string;
  @IsOptional()
  @Transform(blank)
  @IsString()
  @Length(2, 80)
  profession?: string;
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  children!: ChildDto[];
}

export class ParentQuery {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 80) q?: string;
  @IsOptional() @IsString() classroomId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
}
