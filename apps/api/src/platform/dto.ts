import {
  Ownership,
  SchoolType,
  SubscriptionStatus,
  VerificationStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ALL_FEATURES } from '../schools/rules';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upperAll = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => String(v).toUpperCase()) : value;

const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export class ListVerificationsQuery {
  @IsOptional() @IsEnum(VerificationStatus) status?: VerificationStatus;
}

export class ListSchoolsQuery {
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 80) q?: string;
}

export class ReviewDocumentDto {
  @IsIn(['ACCEPTED', 'REJECTED']) status!: 'ACCEPTED' | 'REJECTED';
  @ValidateIf((o: ReviewDocumentDto) => o.status === 'REJECTED')
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  comment?: string;
}

export class MessageDto {
  @Transform(trim) @IsString() @Length(3, 1000) message!: string;
}

export class ReasonDto {
  @Transform(trim) @IsString() @Length(3, 500) reason!: string;
}

export class RequirementDto {
  @Transform(trim) @IsString() @Length(2, 120) name!: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  description?: string;
  @IsBoolean() isMandatory!: boolean;
  @IsArray() @IsIn(MIME_TYPES, { each: true }) acceptedMimeTypes!: string[];
  @IsInt() @Min(102_400) @Max(10 * 1_048_576) maxSizeBytes!: number;
  @Transform(upperAll)
  @IsArray()
  @IsISO31661Alpha2({ each: true })
  countries!: string[];
  @IsArray() @IsEnum(SchoolType, { each: true }) schoolTypes!: SchoolType[];
  @IsArray() @IsEnum(Ownership, { each: true }) ownerships!: Ownership[];
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 200, { each: true })
  checkpoints!: string[];
  @IsBoolean() appliesToExisting!: boolean;
  @ValidateIf((o: RequirementDto) => o.appliesToExisting)
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
}

export class UpdateRequirementDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 120) name?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  description?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(2, 200, { each: true })
  checkpoints?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
}

export class UpdatePlanDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 60) name?: string;
  @IsOptional() @IsInt() @Min(0) priceMonthly?: number;
  @IsOptional() @IsInt() @Min(0) @Max(7) schoolYearFreeMonths?: number;
  @IsOptional()
  @IsArray()
  @IsIn(ALL_FEATURES, { each: true })
  features?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CalendarDto {
  @Transform(({ value }: { value: unknown }) => String(value).toUpperCase())
  @IsISO31661Alpha2()
  country!: string;
  @Matches(/^\d{4}-\d{4}$/) schoolYearLabel!: string;
  @Type(() => Date) @IsDate() startsOn!: Date;
  @Type(() => Date) @IsDate() endsOn!: Date;
}
