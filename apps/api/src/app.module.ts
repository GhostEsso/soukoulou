import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  ApiSecretGuard,
  ClientIpThrottlerGuard,
} from './auth/api-secret.guard';
import { AppController } from './app.controller';
import { AnnouncementsModule } from './announcements/announcements.controller';
import { StorageModule } from './storage/storage.module';
import { DisciplineModule } from './discipline/discipline.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt.guard';
import { MailModule } from './mail/mail.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';
import { FamilySpaceModule } from './family-space/family-space.module';
import { TeacherSpaceModule } from './teacher-space/teacher-space.module';
import { TeachersModule } from './teachers/teachers.module';
import { TimetableModule } from './schedule/schedule.module';
import { GradesModule } from './grades/grades.module';
import { ParentsModule } from './parents/parents.module';
import { AttendanceModule } from './attendance/attendance.module';
import { StudentsModule } from './students/students.module';
import { FeesModule } from './fees/fees.module';
import { StructureModule } from './structure/structure.module';
import { SchoolsModule } from './schools/schools.module';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PAYMENT_WEBHOOK_SECRET',
  'WEB_URL',
];

function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED_ENV.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(', ')}`,
    );
  }
  return env;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    SchoolsModule,
    PlatformModule,
    StructureModule,
    StudentsModule,
    FeesModule,
    AttendanceModule,
    TeachersModule,
    TeacherSpaceModule,
    FamilySpaceModule,
    AnnouncementsModule,
    DisciplineModule,
    StorageModule,
    TimetableModule,
    GradesModule,
    ParentsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ApiSecretGuard },
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
