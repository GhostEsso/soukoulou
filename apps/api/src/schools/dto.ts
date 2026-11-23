import { BillingCycle, Ownership, PaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { HEX_COLOR, SLUG_PATTERN } from './rules';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpgradeInfoDto {
  @IsEnum(Ownership) ownership!: Ownership;
  @Transform(trim) @IsString() @Length(3, 200) address!: string;
  @Transform(trim) @IsString() @Length(6, 20) phone!: string;
  @Transform(lower) @IsEmail() email!: string;
  @Transform(trim) @IsString() @Length(2, 60) authorizationNumber!: string;
  @IsInt() @Min(1) @Max(50_000) approxStudentCount!: number;
  @Transform(lower) @Matches(SLUG_PATTERN) desiredSlug!: string;
}

export class CheckoutDto {
  @IsString() @Length(2, 30) planCode!: string;
  @IsEnum(BillingCycle) billingCycle!: BillingCycle;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
}

export class PaymentWebhookDto {
  @IsString() @Length(1, 100) providerRef!: string;
  @IsEnum(['PAID', 'FAILED']) status!: 'PAID' | 'FAILED';
}

export class ThemeDto {
  @ValidateIf((o: ThemeDto) => o.brandColor !== null)
  @Matches(HEX_COLOR)
  brandColor!: string | null;
}
