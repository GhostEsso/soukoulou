import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { TokenType } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.module';
import { SignupSchoolDto } from './dto';
import { AccessPayload } from './jwt.guard';
import { normalizePhone } from './phone';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const DISCOVERY_DAYS = 15;
const TOKEN_TTL: Record<TokenType, number> = {
  EMAIL_VERIFY: DAY,
  PASSWORD_RESET: HOUR,
  REFRESH: 30 * DAY,
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async signupSchool(dto: SignupSchoolDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Cet email est déjà utilisé.');

    const passwordHash = await hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        memberships: {
          create: {
            role: 'SCHOOL_ADMIN',
            title: dto.title,
            school: {
              create: {
                name: dto.schoolName,
                type: dto.schoolType,
                country: dto.country.toUpperCase(),
                city: dto.city,
                events: { create: { action: 'SIGNED_UP' } },
              },
            },
          },
        },
      },
    });

    const token = await this.issueToken(user.id, 'EMAIL_VERIFY');
    this.mail.send({
      to: user.email,
      subject: 'Confirmez votre adresse email',
      text: `Bienvenue sur Soukoulou. Confirmez votre email : ${this.webUrl('/verifier-email', token)}`,
    });
    return { message: 'Vérifiez votre boîte email pour activer le compte.' };
  }

  async verifyEmail(raw: string) {
    const userId = await this.consumeToken('EMAIL_VERIFY', raw);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: now },
      }),
      // Le mode découverte démarre à la vérification de l'email.
      this.prisma.school.updateMany({
        where: {
          memberships: { some: { userId, role: 'SCHOOL_ADMIN' } },
          subscriptionStatus: 'DISCOVERY',
          discoveryExpiresAt: null,
        },
        data: {
          discoveryExpiresAt: new Date(now.getTime() + DISCOVERY_DAYS * DAY),
        },
      }),
    ]);
    return this.issueSession(userId);
  }

  /** Connexion par email (comptes d'école) ou par téléphone (comptes créés par l'école). */
  async login(identifier: string, password: string) {
    const byEmail = identifier.includes('@');
    const phone = byEmail ? null : normalizePhone(identifier);
    // Sans « @ » : téléphone (parents, enseignants) si le format en est un, sinon matricule
    // (élèves, en minuscules). Un matricule ne peut pas avoir un format de téléphone
    // (assertLoginCode) : un seul champ est cherché, jamais de compte ambigu.
    const user = byEmail
      ? await this.prisma.user.findUnique({ where: { email: identifier } })
      : phone
        ? await this.prisma.user.findUnique({ where: { loginPhone: phone } })
        : await this.prisma.user.findUnique({
            where: { loginCode: identifier.trim().toLowerCase() },
          });
    const ok = user && (await verify(user.passwordHash, password));
    if (!user || !ok) {
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    }
    if (byEmail && !user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Confirmez votre email avant de vous connecter.',
      );
    }
    if (
      user.mustChangePassword &&
      user.tempPasswordExpiresAt &&
      user.tempPasswordExpiresAt < new Date()
    ) {
      throw new ForbiddenException(
        'Ce code de première connexion a expiré : demandez-en un nouveau à l’école.',
      );
    }
    return this.issueSession(user.id);
  }

  /** Remplace le mot de passe (et le code de première connexion) ; les autres sessions sont coupées. */
  async changePassword(userId: string, current: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await verify(user.passwordHash, current))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }
    if (current === password) {
      throw new ConflictException('Choisissez un mot de passe différent.');
    }
    await this.revokeSessions(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(password),
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    });
    return this.issueSession(userId);
  }

  async refresh(raw: string) {
    const row = await this.prisma.authToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!row || row.type !== 'REFRESH' || row.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }
    if (row.usedAt) {
      // Jeton déjà utilisé : probablement volé. On coupe toutes les sessions.
      await this.revokeSessions(row.userId);
      throw new UnauthorizedException();
    }
    await this.consumeToken('REFRESH', raw);
    return this.issueSession(row.userId);
  }

  async logout(raw: string) {
    await this.prisma.authToken.updateMany({
      where: { tokenHash: sha256(raw), type: 'REFRESH', usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // même réponse, que le compte existe ou non
    const token = await this.issueToken(user.id, 'PASSWORD_RESET');
    this.mail.send({
      to: user.email,
      subject: 'Réinitialisation du mot de passe',
      text: `Choisissez un nouveau mot de passe (lien valable 1 h) : ${this.webUrl('/mot-de-passe/nouveau', token)}`,
    });
  }

  async resetPassword(raw: string, password: string) {
    const userId = await this.consumeToken('PASSWORD_RESET', raw);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(password) },
    });
    await this.revokeSessions(userId);
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        loginPhone: true,
        mustChangePassword: true,
        isPlatformAdmin: true,
        memberships: {
          select: {
            role: true,
            title: true,
            school: {
              select: {
                id: true,
                name: true,
                slug: true,
                subscriptionStatus: true,
                brandColor: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
    });
  }

  private async issueSession(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const payload: AccessPayload = { sub: user.id, pa: user.isPlatformAdmin };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.issueToken(user.id, 'REFRESH'),
    };
  }

  private async issueToken(userId: string, type: TokenType) {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL[type]),
      },
    });
    return raw;
  }

  /** Marque un jeton à usage unique comme utilisé. Renvoie l'utilisateur. */
  private async consumeToken(type: TokenType, raw: string) {
    const tokenHash = sha256(raw);
    const row = await this.prisma.authToken.findUnique({
      where: { tokenHash },
    });
    const { count } = await this.prisma.authToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!row || count !== 1) {
      throw new UnauthorizedException('Lien invalide ou expiré.');
    }
    return row.userId;
  }

  private revokeSessions(userId: string) {
    return this.prisma.authToken.updateMany({
      where: { userId, type: 'REFRESH', usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private webUrl(path: string, token: string) {
    return `${this.config.getOrThrow<string>('WEB_URL')}${path}?token=${token}`;
  }
}
