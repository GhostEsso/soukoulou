import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PayoutStatus } from '@prisma/client';
import { MailService } from '../mail/mail.module';
import { NotificationsService } from '../notifications/notifications.module';
import { PrismaService } from '../prisma/prisma.module';
import { fmt, onlineCollected } from './cashbox.service';
import { availableForPayout } from './rules';

const isSerializationFailure = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError
    ? e.code === 'P2034' ||
      (e.meta as { code?: string } | undefined)?.code === '40001'
    : (e as { code?: string } | undefined)?.code === '40001';

/** Demandes de décaissement des sommes encaissées en ligne : école (demande) et Soukoulou (traitement). */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async requestPayout(
    schoolId: string,
    userId: string,
    dto: { amount: number; destination: string },
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [online, payouts] = await Promise.all([
            onlineCollected(tx, schoolId),
            tx.payout.findMany({
              where: { schoolId },
              select: { amount: true, status: true },
            }),
          ]);
          const available = availableForPayout(online, payouts);
          if (dto.amount > available)
            throw new BadRequestException(
              `Montant supérieur au disponible (${fmt(Math.max(available, 0))} FCFA).`,
            );
          return tx.payout.create({
            data: {
              schoolId,
              amount: dto.amount,
              destination: dto.destination,
              requestedById: userId,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e) {
      if (isSerializationFailure(e))
        throw new ConflictException('Réessayez dans un instant.');
      throw e;
    }
  }

  async listPayouts(schoolId: string) {
    const [online, items] = await Promise.all([
      onlineCollected(this.prisma, schoolId),
      this.prisma.payout.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { available: availableForPayout(online, items), items };
  }

  listAll(status?: PayoutStatus) {
    return this.prisma.payout.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true } } },
    });
  }

  markPaid(id: string, adminId: string, providerRef: string) {
    return this.process(id, adminId, 'PAID', { providerRef }, (amount) => ({
      subject: `Décaissement effectué : ${fmt(amount)} FCFA`,
      text: `Votre décaissement de ${fmt(amount)} FCFA a été effectué (référence ${providerRef}).`,
    }));
  }

  reject(id: string, adminId: string, reason: string) {
    return this.process(
      id,
      adminId,
      'REJECTED',
      { rejectReason: reason },
      (amount) => ({
        subject: `Décaissement refusé : ${fmt(amount)} FCFA`,
        text: `Votre demande de décaissement de ${fmt(amount)} FCFA a été refusée. Motif : ${reason}`,
      }),
    );
  }

  private async process(
    id: string,
    adminId: string,
    status: 'PAID' | 'REJECTED',
    data: { providerRef?: string; rejectReason?: string },
    mail: (amount: number) => { subject: string; text: string },
  ) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException();
    // Une seule issue possible : le premier traitement gagne.
    const { count } = await this.prisma.payout.updateMany({
      where: { id, status: 'REQUESTED' },
      data: {
        ...data,
        status,
        processedById: adminId,
        processedAt: new Date(),
      },
    });
    if (count !== 1) throw new ConflictException('Demande déjà traitée.');
    const owners = await this.prisma.membership.findMany({
      where: { schoolId: payout.schoolId, role: 'SCHOOL_ADMIN' },
      select: { user: { select: { email: true } } },
    });
    const m = mail(payout.amount);
    for (const o of owners) this.mail.send({ to: o.user.email, ...m });
    await this.notifications.toAdmins(
      payout.schoolId,
      { kind: 'PAYOUT', title: m.subject, body: m.text },
      '/frais/decaissements',
    );
    return this.prisma.payout.findUniqueOrThrow({ where: { id } });
  }
}
