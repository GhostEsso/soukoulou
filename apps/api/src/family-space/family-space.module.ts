import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { GradesModule } from '../grades/grades.module';
import { TimetableModule } from '../schedule/schedule.module';
import { ParentSpaceController } from './parent-space.controller';
import { StudentSpaceController } from './student-space.controller';

@Module({
  imports: [AttendanceModule, GradesModule, TimetableModule],
  controllers: [ParentSpaceController, StudentSpaceController],
})
/** Espaces famille : parents et élèves, en lecture seule. */
export class FamilySpaceModule {}
