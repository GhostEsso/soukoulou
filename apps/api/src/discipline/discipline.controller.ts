import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import { isoDay, parseDay } from '../attendance/rules';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { NotificationsService } from '../notifications/notifications.module';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import { SchoolsModule } from '../schools/schools.module';

const KINDS = ['MERIT', 'PUNISHMENT', 'BLAME'] as const;

export class DisciplineDto {
  @IsString() studentId!: string;
  @IsIn(KINDS, { message: 'Type invalide.' }) kind!: (typeof KINDS)[number];
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500, { message: 'Motif obligatoire (500 caractères max).' })
  reason!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide.' }) day!: string;
}

/** Dossier de discipline d'un élève, du plus récent au plus ancien (fiche, espaces parent et élève). */
export async function disciplineOf(
  prisma: PrismaService,
  schoolId: string,
  studentId: string,
) {
  const rows = await prisma.disciplineRecord.findMany({
    where: { schoolId, studentId },
    orderBy: [{ day: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, kind: true, reason: true, day: true },
  });
  return rows.map((r) => ({ ...r, day: isoDay(r.day) }));
}

/** Mérites, punitions et blâmes : l'administration les inscrit, l'élève et ses parents les voient. */
@Controller('schools/:schoolId/discipline')
export class DisciplineController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('studentId') studentId: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return disciplineOf(this.prisma, s, studentId ?? '');
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() { studentId, kind, reason, day }: DisciplineDto,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    const { access, denial } = await this.onboarding.can(s, 'write');
    if (!access) throw new ForbiddenException(denial);
    const date = parseDay(day);
    if (!date || day > isoDay(new Date()))
      throw new BadRequestException('Date invalide : pas de date future.');
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: s },
      select: { id: true, firstName: true },
    });
    if (!student) throw new NotFoundException('Élève introuvable.');
    const label = { MERIT: 'Mérite', PUNISHMENT: 'Punition', BLAME: 'Blâme' }[
      kind
    ];
    const record = await this.prisma.disciplineRecord.create({
      data: {
        schoolId: s,
        studentId,
        kind,
        reason,
        day: date,
        createdById: u.id,
      },
      select: { id: true },
    });
    await this.notifications.toFamily(s, studentId, {
      kind: 'DISCIPLINE',
      title: `${label} : ${student.firstName}`,
      body: reason,
    });
    return record;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    const { access, denial } = await this.onboarding.can(s, 'write');
    if (!access) throw new ForbiddenException(denial);
    const { count } = await this.prisma.disciplineRecord.deleteMany({
      where: { id, schoolId: s },
    });
    if (!count) throw new NotFoundException();
  }
}

@Module({
  imports: [SchoolsModule],
  controllers: [DisciplineController],
})
export class DisciplineModule {}
