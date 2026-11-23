import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailService } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.module';

const DAY = 86_400_000;
const GRACE_DAYS = 1;
const DISCOVERY_REMINDERS = [10, 5, 1]; // jours restants : J+5, J+10, J+14 sur 15 jours
const RENEWAL_REMINDERS = [15, 7, 1];

const daysBetween = (from: Date, to: Date) =>
  Math.ceil((to.getTime() - from.getTime()) / DAY);

/** Tâches quotidiennes : expiration du mode découverte, échéances, vacances, rappels. */
@Injectable()
export class LifecycleService {
  private readonly logger = new Logger('Lifecycle');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron('0 6 * * *')
  async cron() {
    await this.runDaily(new Date());
  }

  async runDaily(now: Date) {
    await this.expireDiscovery(now);
    await this.expireSubscriptions(now);
    await this.endVacations(now);
    await this.remind(now);
  }

  /** Mode découverte terminé sans upgrade : l'école et ses comptes sans autre école sont supprimés. */
  private async expireDiscovery(now: Date) {
    const schools = await this.prisma.school.findMany({
      where: {
        subscriptionStatus: 'DISCOVERY',
        discoveryExpiresAt: { lt: now },
      },
      select: { id: true, memberships: { select: { userId: true } } },
    });
    for (const s of schools) {
      const userIds = s.memberships.map((m) => m.userId);
      await this.prisma.$transaction([
        this.prisma.school.delete({ where: { id: s.id } }),
        this.prisma.user.deleteMany({
          where: {
            id: { in: userIds },
            isPlatformAdmin: false,
            memberships: { none: {} },
          },
        }),
      ]);
    }
    if (schools.length)
      this.logger.log(`${schools.length} compte(s) découverte supprimé(s)`);
  }

  /** Abonnement échu + 1 jour de grâce : lecture seule en vacances, suspension sinon. */
  private async expireSubscriptions(now: Date) {
    const cutoff = new Date(now.getTime() - GRACE_DAYS * DAY);
    const schools = await this.prisma.school.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: { lt: cutoff },
      },
      select: { id: true, country: true },
    });
    for (const s of schools) {
      const vacation = await this.isVacation(s.country, now);
      const status = vacation ? 'READ_ONLY' : 'SUSPENDED';
      await this.prisma.school.update({
        where: { id: s.id },
        data: {
          subscriptionStatus: status,
          events: { create: { action: status, message: 'Abonnement échu' } },
        },
      });
    }
  }

  /** Rentrée + 1 jour sans réabonnement : les écoles en lecture seule sont suspendues. */
  private async endVacations(now: Date) {
    const schools = await this.prisma.school.findMany({
      where: { subscriptionStatus: 'READ_ONLY' },
      select: { id: true, country: true },
    });
    for (const s of schools) {
      const year = await this.currentYear(s.country, now);
      if (!year || now.getTime() < year.startsOn.getTime() + GRACE_DAYS * DAY)
        continue;
      await this.prisma.school.update({
        where: { id: s.id },
        data: {
          subscriptionStatus: 'SUSPENDED',
          events: {
            create: {
              action: 'SUSPENDED',
              message: 'Rentrée sans réabonnement',
            },
          },
        },
      });
    }
  }

  // ponytail: rappels calculés sur le nombre exact de jours restants, un passage par jour. Pas de table d'envois.
  private async remind(now: Date) {
    const admins = {
      where: { role: 'SCHOOL_ADMIN' as const },
      select: { user: { select: { email: true } } },
    };

    const discovery = await this.prisma.school.findMany({
      where: {
        subscriptionStatus: 'DISCOVERY',
        discoveryExpiresAt: { gt: now },
      },
      select: { name: true, discoveryExpiresAt: true, memberships: admins },
    });
    for (const s of discovery) {
      const left = daysBetween(now, s.discoveryExpiresAt!);
      if (!DISCOVERY_REMINDERS.includes(left)) continue;
      for (const m of s.memberships) {
        this.mail.send({
          to: m.user.email,
          subject: `Votre découverte de Soukoulou se termine dans ${left} jour(s)`,
          text: `Passez à l’abonnement pour gérer ${s.name} pour de vrai. Sans upgrade, le compte sera supprimé.`,
        });
      }
    }

    const active = await this.prisma.school.findMany({
      where: { subscriptionStatus: 'ACTIVE', subscriptionEndsAt: { gt: now } },
      select: { name: true, subscriptionEndsAt: true, memberships: admins },
    });
    for (const s of active) {
      const left = daysBetween(now, s.subscriptionEndsAt!);
      if (!RENEWAL_REMINDERS.includes(left)) continue;
      for (const m of s.memberships) {
        this.mail.send({
          to: m.user.email,
          subject: `Votre abonnement se termine dans ${left} jour(s)`,
          text: `Renouvelez l’abonnement de ${s.name} pour continuer sans interruption.`,
        });
      }
    }
  }

  private currentYear(country: string, now: Date) {
    return this.prisma.schoolCalendar.findFirst({
      where: { country, startsOn: { lte: now }, endsOn: { gte: now } },
    });
  }

  /** Vacances = aucune année scolaire en cours pour le pays (et au moins une année définie). */
  private async isVacation(country: string, now: Date) {
    const anyYear = await this.prisma.schoolCalendar.count({
      where: { country },
    });
    return anyYear > 0 && !(await this.currentYear(country, now));
  }
}
