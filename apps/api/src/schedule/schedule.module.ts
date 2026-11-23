import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [SchoolsModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class TimetableModule {}
