import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [SchoolsModule],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
