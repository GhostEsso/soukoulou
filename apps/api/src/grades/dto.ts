import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

export class AssessmentDto {
  @IsString() classroomId!: string;
  @IsString() subjectId!: string;
  @Transform(trim) @IsString() @Length(1, 80) title!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide.' }) day!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) maxScore!: number;
}

export class AssessmentQuery {
  @IsOptional() @IsString() classroomId?: string;
}

export class ReportCardQuery {
  @IsString() classroomId!: string;
  @IsString() periodId!: string;
}

export class PerformanceQuery {
  @IsString() teacherId!: string;
}

export class GradeItem {
  @IsString() studentId!: string;
  /** null = pas de note (absent, non rendu) : la note existante est effacée. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) score!:
    number | null;
}

export class GradesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GradeItem)
  items!: GradeItem[];
}

export class CouncilItem {
  @IsString() studentId!: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 300) comment?: string;
  @IsOptional() @IsIn(['PROMOTED', 'REPEATING']) decision?:
    'PROMOTED' | 'REPEATING';
}

export class CouncilDto {
  @IsString() classroomId!: string;
  /** Id de la période, ou "annual" pour le bilan de l'année. */
  @IsString() scope!: string;
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CouncilItem)
  items!: CouncilItem[];
}
