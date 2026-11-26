import {
  Controller,
  Get,
  Global,
  HttpCode,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';

export type NotificationKind =
  | 'PAYMENT'
  | 'ANNOUNCEMENT'
  | 'ATTENDANCE'
  | 'DISCIPLINE'
  | 'GRADE'
  | 'REPORT_CARD'
  | 'FEE_REMINDER'
  | 'PAYOUT'
  | 'SCHOOL';

export interface NewNotification {
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
}

const money = (n: number) =>
  `${n.toLocaleString('fr-FR').replace(/\s/g, ' ')} FCFA`;

/** Espace web de chaque rôle : les liens des notifications y pointent. */
const SPACE: Partial<Record<Role, string>> = {
  SCHOOL_ADMIN: 'ecole',
  TEACHER: 'prof',
  PARENT: 'parent',
  STUDENT: 'eleve',
};

/**
 * Notifications dans l'application (la cloche). Une notification ne doit jamais faire échouer
 * l'action qui la déclenche : les erreurs sont journalisées puis ignorées.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(private readonly prisma: PrismaService) {}

  async send(
    schoolId: string,
    userIds: (string | null | undefined)[],
    n: NewNotification,
  ) {
    const ids = [...new Set(userIds.filter((u): u is string => !!u))];
    if (!ids.length) return;
    await this.prisma.notification
      .createMany({ data: ids.map((userId) => ({ userId, schoolId, ...n })) })
      .catch((e: unknown) =>
        this.logger.error(`${n.kind} : ${(e as Error).message}`),
      );
  }

  /** Administration de l'école ; `path` est relatif à /ecole/{école}. */
  async toAdmins(schoolId: string, n: NewNotification, path = '') {
    const admins = await this.prisma.membership.findMany({
      where: { schoolId, role: 'SCHOOL_ADMIN' },
      select: { userId: true },
    });
    await this.send(
      schoolId,
      admins.map((a) => a.userId),
      { ...n, href: `/ecole/${schoolId}${path}` },
    );
  }

  /** Parents (avec un compte) d'un élève, et l'élève lui-même s'il en a un. */
  async toFamily(
    schoolId: string,
    studentId: string,
    n: NewNotification,
    { student = true } = {},
  ) {
    const st = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        userId: true,
        parents: { select: { parent: { select: { userId: true } } } },
      },
    });
    if (!st) return;
    await Promise.all([
      this.send(
        schoolId,
        st.parents.map((p) => p.parent.userId),
        { ...n, href: `/parent/${schoolId}/enfants/${studentId}` },
      ),
      student &&
        this.send(schoolId, [st.userId], { ...n, href: `/eleve/${schoolId}` }),
    ]);
  }

  /** Membres de l'école ayant l'un des rôles ; le lien est construit pour l'espace de chacun. */
  async toRoles(
    schoolId: string,
    roles: Role[],
    n: NewNotification,
    path: (space: string) => string,
  ) {
    const members = await this.prisma.membership.findMany({
      where: { schoolId, role: { in: roles } },
      select: { userId: true, role: true },
    });
    for (const role of roles) {
      const space = SPACE[role];
      if (!space) continue;
      await this.send(
        schoolId,
        members.filter((m) => m.role === role).map((m) => m.userId),
        { ...n, href: `/${space}/${schoolId}${path(space)}` },
      );
    }
  }

  /** Paiement de frais confirmé : la famille (reçu, reste à payer) ; l'école si payé en ligne. */
  async feePaid(paymentId: string) {
    const p = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      select: {
        schoolId: true,
        amount: true,
        method: true,
        receiptNumber: true,
        studentFee: {
          select: {
            studentId: true,
            student: { select: { firstName: true, lastName: true } },
            lines: { select: { amount: true } },
            payments: { where: { status: 'PAID' }, select: { amount: true } },
          },
        },
      },
    });
    if (!p) return;
    const f = p.studentFee;
    const sum = (xs: { amount: number }[]) =>
      xs.reduce((s, x) => s + x.amount, 0);
    const left = sum(f.lines) - sum(f.payments);
    const who = `${f.student.firstName} ${f.student.lastName}`;
    const body = `${who} · reçu ${p.receiptNumber ?? '—'} · reste à payer ${money(Math.max(0, left))}`;
    await this.toFamily(
      p.schoolId,
      f.studentId,
      { kind: 'PAYMENT', title: `Paiement reçu : ${money(p.amount)}`, body },
      { student: false },
    );
    if (p.method !== 'CASH')
      await this.toAdmins(
        p.schoolId,
        {
          kind: 'PAYMENT',
          title: `Paiement en ligne : ${money(p.amount)}`,
          body,
        },
        '/frais/tableau-de-bord',
      );
  }

  async list(userId: string, schoolId: string) {
    const where = { userId, schoolId };
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unread };
  }

  async readAll(userId: string, schoolId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, schoolId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

/** Ses propres notifications uniquement : filtrées par l'utilisateur connecté. */
@Controller('schools/:schoolId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    return this.notifications.list(u.id, s);
  }

  @Post('read')
  @HttpCode(204)
  async readAll(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    await this.notifications.readAll(u.id, s);
  }
}

@Global()
@Module({
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
