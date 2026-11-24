import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { CashboxService } from '../fees/cashbox.service';
import { onlinePaymentReady } from '../fees/online.service';
import { OnboardingService } from '../schools/onboarding.service';
import { FEATURES } from '../schools/rules';
import { disciplineOf } from '../discipline/discipline.controller';
import { GradesService } from '../grades/grades.service';
import { PrismaService } from '../prisma/prisma.module';
import { photoVersion } from '../storage/storage.module';
import { ScheduleService } from '../schedule/schedule.service';

/**
 * Espace parent : un compte PARENT ne voit que ses enfants (lecture seule).
 * Chaque appel retrouve la fiche parent liée au compte, sinon 403.
 */
@Controller('schools/:schoolId/parent')
export class ParentSpaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grades: GradesService,
    private readonly attendance: AttendanceService,
    private readonly schedule: ScheduleService,
    private readonly cashbox: CashboxService,
    private readonly onboarding: OnboardingService,
  ) {}

  /** Le parent et ses enfants, avec leur classe de l'année en cours. */
  @Get()
  async home(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId: s },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    const p = await this.prisma.parent.findFirst({
      where: { schoolId: s, userId: u.id },
      select: {
        firstName: true,
        lastName: true,
        school: { select: { name: true } },
        children: {
          orderBy: { student: { firstName: 'asc' } },
          select: {
            relation: true,
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                sex: true,
                matricule: true,
                photoKey: true,
                enrollments: {
                  where: { yearId: year?.id ?? '' },
                  select: { classroom: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!p)
      throw new ForbiddenException(
        'Ce compte n’est pas celui d’un parent de cette école.',
      );
    return {
      ...p,
      children: p.children.map(
        ({ relation, student: { enrollments, photoKey, ...c } }) => ({
          ...c,
          photo: photoVersion(photoKey),
          relation,
          classroom: enrollments[0]?.classroom ?? null,
        }),
      ),
    };
  }

  /** Suivi d'un enfant : notes et moyennes par période, assiduité, emploi du temps de sa classe, frais de scolarité. */
  @Get('children/:studentId')
  async child(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('studentId') studentId: string,
  ) {
    const home = await this.home(u, s);
    const child = home.children.find((c) => c.id === studentId);
    if (!child) throw new NotFoundException();
    const [report, attendance, slots, discipline, fees] = await Promise.all([
      this.grades.studentReport(s, studentId),
      this.attendance.student(s, studentId),
      child.classroom
        ? this.schedule.list(s, { classroomId: child.classroom.id })
        : [],
      disciplineOf(this.prisma, s, studentId),
      this.cashbox.studentFee(s, studentId),
    ]);
    const canPay =
      !!fees &&
      (await this.onboarding.can(s, 'collect', FEATURES.FEE_PAYMENTS)).access &&
      onlinePaymentReady();
    return {
      child,
      report,
      attendance,
      slots,
      discipline,
      fees: fees && { ...fees, canPay },
    };
  }

  /** Reçu d'un paiement des frais d'un de ses enfants (à imprimer ou enregistrer en PDF). */
  @Get('children/:studentId/fees/receipts/:paymentId')
  async receipt(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('studentId') studentId: string,
    @Param('paymentId') paymentId: string,
  ) {
    const home = await this.home(u, s);
    if (!home.children.some((c) => c.id === studentId))
      throw new NotFoundException();
    return this.cashbox.receipt(s, paymentId, studentId);
  }
}
