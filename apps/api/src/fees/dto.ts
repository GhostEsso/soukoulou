import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class LineDto {
  @IsInt({ message: 'Montant invalide.' })
  @Min(1, { message: 'Montant invalide.' })
  @Max(100_000_000, { message: 'Montant invalide.' })
  amount!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide.' })
  dueOn!: string;
}

export class ScheduleDto {
  @IsString() yearId!: string;
  @IsOptional()
  @IsString()
  @Length(1, 80, { message: 'Libellé : 80 caractères max.' })
  label?: string;
  @ValidateIf((o: ScheduleDto) => o.sex !== null)
  @IsIn(['MALE', 'FEMALE'], { message: 'Public invalide.' })
  sex!: 'MALE' | 'FEMALE' | null;
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins un niveau.' })
  @ArrayMaxSize(50)
  @IsString({ each: true })
  levelIds!: string[];
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une tranche.' })
  @ArrayMaxSize(12, { message: 'Douze tranches au plus.' })
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];
}

export class CashDto {
  @IsString() studentId!: string;
  @IsInt({ message: 'Montant invalide.' })
  @Min(1, { message: 'Montant invalide.' })
  @Max(100_000_000, { message: 'Montant invalide.' })
  amount!: number;
}
