import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { StructureController } from './structure.controller';
import { StructureService } from './structure.service';

@Module({
  imports: [SchoolsModule],
  controllers: [StructureController],
  providers: [StructureService],
})
export class StructureModule {}
