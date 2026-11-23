import { SchoolType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SignupSchoolDto {
  @Transform(trim) @IsString() @Length(2, 120) schoolName!: string;
  @IsEnum(SchoolType) schoolType!: SchoolType;
  @IsISO31661Alpha2() country!: string;
  @Transform(trim) @IsString() @Length(2, 80) city!: string;

  @Transform(trim) @IsString() @Length(1, 60) firstName!: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) title?: string;
  @Transform(trim) @IsString() @Length(6, 20) phone!: string;
  @Transform(lower) @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class LoginDto {
  /** Email (comptes d'école) ou numéro de téléphone (comptes créés par l'école). */
  @Transform(lower) @IsString() @Length(3, 120) identifier!: string;
  @IsString() @MaxLength(128) password!: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) current!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class TokenDto {
  @IsString() @Length(20, 200) token!: string;
}

export class RefreshDto {
  @IsString() @Length(20, 200) refreshToken!: string;
}

export class ForgotPasswordDto {
  @Transform(lower) @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @Length(20, 200) token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
