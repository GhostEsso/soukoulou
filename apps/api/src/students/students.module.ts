import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { SchoolsModule } from '../schools/schools.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [SchoolsModule, FeesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
