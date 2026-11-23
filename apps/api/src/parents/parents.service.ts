import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import { grantAccess, removeAccess, resetAccess } from '../auth/accounts';
import type { ParentDto, ParentQuery } from './dto';

export const PAGE_SIZE = 20;

/** Parents et tuteurs, rattachés à leurs enfants. Tout est filtré par schoolId. */
@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  private async assertWrite(schoolId: string) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
  }

  /** Enfants avec leur classe de l'année en cours. */
  private async children(schoolId: string) {
    const y = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    return {
      yearId: y?.id ?? '',
      include: {
        user: { select: { loginPhone: true, mustChangePassword: true } },
        children: {
          orderBy: { student: { firstName: 'asc' as const } },
          select: {
            relation: true,
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                enrollments: {
                  where: { yearId: y?.id ?? '' },
                  select: { classroom: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    };
  }

  async list(schoolId: string, q: ParentQuery) {
    const page = q.page ?? 1;
    const { yearId, include } = await this.children(schoolId);
    const words = (q.q ?? '').split(' ').filter(Boolean);
    const where: Prisma.ParentWhereInput = {
      schoolId,
      ...(q.classroomId && {
        children: {
          some: {
            student: {
              enrollments: { some: { classroomId: q.classroomId, yearId } },
            },
          },
        },
      }),
      // Chaque mot : nom, prénom, téléphone, email du parent, ou nom/prénom d'un enfant.
      AND: words.map((w) => {
        const has = { contains: w, mode: 'insensitive' as const };
        return {
          OR: [
            { firstName: has },
            { lastName: has },
            { phone: has },
            { email: has },
            {
              children: {
                some: {
                  student: { OR: [{ firstName: has }, { lastName: has }] },
                },
              },
            },
          ],
        };
      }),
    };
    const [total, items] = await Promise.all([
      this.prisma.parent.count({ where }),
      this.prisma.parent.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include,
      }),
    ]);
    return { total, page, pageSize: PAGE_SIZE, items: items.map(shape) };
  }

  async get(schoolId: string, id: string) {
    const { include } = await this.children(schoolId);
    const p = await this.prisma.parent.findFirst({
      where: { id, schoolId },
      include,
    });
    if (!p) throw new NotFoundException();
    return shape(p);
  }

  async create(schoolId: string, dto: ParentDto) {
    await this.assertWrite(schoolId);
    await this.checkChildren(schoolId, dto);
    try {
      return await this.prisma.parent.create({
        data: {
          schoolId,
          ...fields(dto),
          children: { create: dto.children },
        },
        select: { id: true },
      });
    } catch (e) {
      throw unique(e);
    }
  }

  /** Met à jour la fiche et remplace la liste des enfants. */
  async update(schoolId: string, id: string, dto: ParentDto) {
    await this.assertWrite(schoolId);
    await this.own(schoolId, id);
    await this.checkChildren(schoolId, dto);
    try {
      await this.prisma.$transaction([
        this.prisma.parent.update({
          where: { id },
          data: fields(dto, true),
        }),
        this.prisma.parentChild.deleteMany({ where: { parentId: id } }),
        this.prisma.parentChild.createMany({
          data: dto.children.map((c) => ({ ...c, parentId: id })),
        }),
      ]);
    } catch (e) {
      throw unique(e);
    }
  }

  async remove(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    await this.own(schoolId, id);
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.parent.delete({ where: { id } });
      if (p.userId) await removeAccess(tx, p.userId, schoolId);
    });
  }

  /** Accès du parent à son espace (voir auth/accounts) : identifiant = son téléphone. */
  async createAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const p = await this.prisma.parent.findFirst({
      where: { id, schoolId },
      select: { userId: true, phone: true, firstName: true, lastName: true },
    });
    if (!p) throw new NotFoundException();
    if (p.userId) throw new ConflictException('Ce parent a déjà un accès.');
    return this.prisma.$transaction(async (tx) => {
      const r = await grantAccess(tx, { schoolId, role: 'PARENT', ...p });
      await tx.parent.update({ where: { id }, data: { userId: r.userId } });
      return { phone: r.login, code: r.code };
    });
  }

  async resetAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const userId = await this.accountOf(schoolId, id);
    return this.prisma.$transaction((tx) => resetAccess(tx, userId, schoolId));
  }

  async removeAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const userId = await this.accountOf(schoolId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.parent.update({ where: { id }, data: { userId: null } });
      await removeAccess(tx, userId, schoolId);
    });
  }

  private async accountOf(schoolId: string, id: string) {
    const p = await this.prisma.parent.findFirst({
      where: { id, schoolId },
      select: { userId: true },
    });
    if (!p) throw new NotFoundException();
    if (!p.userId)
      throw new ConflictException('Ce parent n’a pas encore d’accès.');
    return p.userId;
  }

  private async checkChildren(schoolId: string, dto: ParentDto) {
    const ids = [...new Set(dto.children.map((c) => c.studentId))];
    if (ids.length !== dto.children.length)
      throw new BadRequestException(
        'Un enfant figure deux fois dans la liste.',
      );
    const found = await this.prisma.student.count({
      where: { schoolId, id: { in: ids } },
    });
    if (found !== ids.length)
      throw new BadRequestException('Un des enfants est introuvable.');
  }

  private async own(schoolId: string, id: string) {
    const p = await this.prisma.parent.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException();
  }
}

type WithChildren = {
  userId: string | null;
  user: { loginPhone: string | null; mustChangePassword: boolean } | null;
  children: {
    relation: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      enrollments: { classroom: { id: string; name: string } }[];
    };
  }[];
};

function shape<T extends WithChildren>({ children, user, ...p }: T) {
  return {
    ...p,
    account: user && {
      phone: user.loginPhone,
      pending: user.mustChangePassword,
    },
    children: children.map(({ relation, student: { enrollments, ...s } }) => ({
      ...s,
      relation,
      classroom: enrollments[0]?.classroom ?? null,
    })),
  };
}

function fields(dto: ParentDto, update = false) {
  // En modification, un champ facultatif vidé est effacé (null) ; en création il est simplement absent.
  const opt = (v: string | undefined) => v ?? (update ? null : undefined);
  return {
    firstName: dto.firstName,
    lastName: dto.lastName.toUpperCase(),
    phone: dto.phone,
    email: opt(dto.email?.toLowerCase()),
    address: opt(dto.address),
    profession: opt(dto.profession),
  };
}

function unique(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return new ConflictException(
      'Ce numéro de téléphone est déjà celui d’un autre parent : ouvrez sa fiche pour lui ajouter cet enfant.',
    );
  }
  return e;
}
