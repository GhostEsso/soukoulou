import { BadRequestException, ConflictException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import type { Prisma, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { normalizePhone, tempCode } from './phone';

/** Validité du code de première connexion. */
const CODE_DAYS = 7;
type Tx = Prisma.TransactionClient;

const fresh = async () => {
  const code = tempCode(randomBytes);
  return {
    code,
    data: {
      passwordHash: await hash(code),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + CODE_DAYS * 86_400_000),
    },
  };
};

/**
 * Comptes créés par l'école (enseignant, parent) : identifiant = téléphone, code de première
 * connexion renvoyé une seule fois. Numéro déjà connu (autre école) : compte rattaché, sans code.
 */
export async function grantAccess(
  tx: Tx,
  p: {
    schoolId: string;
    role: Role;
    phone: string | null;
    firstName: string;
    lastName: string;
    /** Élève : se connecte avec son matricule, jamais rattaché à un compte existant. */
    matricule?: string | null;
  },
) {
  if (p.role === 'STUDENT') {
    const loginCode = p.matricule?.trim().toLowerCase();
    if (!loginCode)
      throw new BadRequestException(
        'Renseignez d’abord le matricule de l’élève : il servira d’identifiant.',
      );
    if (await tx.user.findUnique({ where: { loginCode } }))
      throw new ConflictException(
        'Ce matricule sert déjà d’identifiant à un autre compte Soukoulou : modifiez-le (préfixe de l’école, par exemple).',
      );
    const { code, data } = await fresh();
    const u = await tx.user.create({
      data: {
        ...data,
        loginCode,
        firstName: p.firstName,
        lastName: p.lastName,
        memberships: { create: { schoolId: p.schoolId, role: p.role } },
      },
      select: { id: true },
    });
    return { userId: u.id, login: p.matricule!.trim(), code };
  }
  const phone = p.phone && normalizePhone(p.phone);
  if (!phone)
    throw new BadRequestException(
      'Renseignez d’abord un numéro de téléphone valide : il servira d’identifiant.',
    );
  const existing = await tx.user.findUnique({
    where: { loginPhone: phone },
    select: { id: true, memberships: { where: { schoolId: p.schoolId } } },
  });
  if (existing?.memberships.length)
    throw new ConflictException(
      'Ce numéro est déjà celui d’un compte de l’école (enseignant, parent ou administrateur).',
    );
  if (existing) {
    await tx.membership.create({
      data: { userId: existing.id, schoolId: p.schoolId, role: p.role },
    });
    return { userId: existing.id, login: phone, code: null };
  }
  const { code, data } = await fresh();
  const u = await tx.user.create({
    data: {
      ...data,
      loginPhone: phone,
      phone: p.phone,
      firstName: p.firstName,
      lastName: p.lastName,
      memberships: { create: { schoolId: p.schoolId, role: p.role } },
    },
    select: { id: true },
  });
  return { userId: u.id, login: phone, code };
}

/** Nouveau code (mot de passe oublié) ; les sessions en cours sont coupées. */
export async function resetAccess(tx: Tx, userId: string) {
  const { code, data } = await fresh();
  const u = await tx.user.update({
    where: { id: userId },
    data,
    select: { loginPhone: true, loginCode: true },
  });
  await revokeSessions(tx, userId);
  return { phone: u.loginPhone ?? u.loginCode, code };
}

/** Retire l'accès à l'école ; le compte est supprimé s'il ne sert plus à rien. */
export async function removeAccess(tx: Tx, userId: string, schoolId: string) {
  await tx.membership.deleteMany({ where: { userId, schoolId } });
  await revokeSessions(tx, userId);
  await tx.user.deleteMany({
    where: { id: userId, isPlatformAdmin: false, memberships: { none: {} } },
  });
}

function revokeSessions(tx: Tx, userId: string) {
  return tx.authToken.updateMany({
    where: { userId, type: 'REFRESH', usedAt: null },
    data: { usedAt: new Date() },
  });
}
