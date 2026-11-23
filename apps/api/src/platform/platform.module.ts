import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [SchoolsModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
