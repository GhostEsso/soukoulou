import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { GradesModule } from '../grades/grades.module';
import { TimetableModule } from '../schedule/schedule.module';
import { TeacherSpaceController } from './teacher-space.controller';
import { TeacherSpaceService } from './teacher-space.service';

@Module({
  imports: [AttendanceModule, GradesModule, TimetableModule],
  controllers: [TeacherSpaceController],
  providers: [TeacherSpaceService],
})
export class TeacherSpaceModule {}
