import {
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
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Length,
} from 'class-validator';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import { SchoolsModule } from '../schools/schools.module';

const AUDIENCES = ['TEACHER', 'PARENT', 'STUDENT'] as const;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AnnouncementDto {
  @Transform(trim) @IsString() @Length(1, 120) title!: string;
  @Transform(trim) @IsString() @Length(1, 2000) body!: string;
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins un public.' })
  @ArrayUnique()
  @IsIn(AUDIENCES, { each: true })
  audiences!: (typeof AUDIENCES)[number][];
}

const SELECT = {
  id: true,
  title: true,
  body: true,
  audiences: true,
  createdAt: true,
} as const;

/** Annonces de l'école : l'administration publie, chaque espace lit celles qui le concernent. */
@Controller('schools/:schoolId/announcements')
export class AnnouncementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.prisma.announcement.findMany({
      where: { schoolId: s },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: SELECT,
    });
  }

  /** Pour un enseignant, un parent ou un élève : les 20 dernières annonces qui le visent. */
  @Get('feed')
  async feed(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: u.id, schoolId: s } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException();
    return this.prisma.announcement.findMany({
      where: { schoolId: s, audiences: { has: m.role } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, body: true, createdAt: true },
    });
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: AnnouncementDto,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    const { access, denial } = await this.onboarding.can(s, 'write');
    if (!access) throw new ForbiddenException(denial);
    return this.prisma.announcement.create({
      data: { ...dto, schoolId: s, createdById: u.id },
      select: { id: true },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    const { count } = await this.prisma.announcement.deleteMany({
      where: { id, schoolId: s },
    });
    if (!count) throw new NotFoundException();
  }
}

@Module({
  imports: [SchoolsModule],
  controllers: [AnnouncementsController],
})
export class AnnouncementsModule {}
